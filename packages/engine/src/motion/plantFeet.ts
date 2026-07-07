import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieQuaternion,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { aimRotation } from "../kinematics/aimRotation";
import { decomposeJointRotation } from "../kinematics/decomposeJointRotation";
import { IAutoMovieResolvedBone, resolvePose } from "../kinematics/resolvePose";
import { solveTwoBoneIK } from "../kinematics/solveTwoBoneIK";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { sampleMotion } from "./sampleMotion";

/** World-down, the pole a natural knee bends away from (as {@link reachPose}). */
const POLE: IAutoMovieVector3 = { x: 0, y: -1, z: 0 };
const DEFAULT_SAMPLE_RATE = 24;
const DEFAULT_GROUND_Y = 0;
const DEFAULT_TOLERANCE = 0.02;

/**
 * The leg chain that plants one foot: the foot end-effector and its upper/lower
 * segments (hip→knee, knee→ankle).
 *
 * @author Samchon
 */
export interface IAutoMovieFootLeg {
  /** Foot end-effector bone (the ground-contact point that is pinned). */
  foot: AutoMovieHumanoidBone;
  /** Upper leg segment (thigh) — the chain root. */
  upper: AutoMovieHumanoidBone;
  /** Lower leg segment (shin). */
  lower: AutoMovieHumanoidBone;
}

const DEFAULT_LEGS: readonly IAutoMovieFootLeg[] = [
  { foot: "leftFoot", upper: "leftUpperLeg", lower: "leftLowerLeg" },
  { foot: "rightFoot", upper: "rightUpperLeg", lower: "rightLowerLeg" },
];

/**
 * One planted-foot stance run the pass detected and pinned: the foot stayed on
 * the ground from `start` to `end` and its world position was held at
 * `position` (its `y` snapped to the ground plane).
 *
 * @author Samchon
 */
export interface IAutoMovieFootPlant {
  /** The planted foot bone. */
  foot: AutoMovieHumanoidBone;
  /** Inclusive stance-run start, seconds. */
  start: number;
  /** Inclusive stance-run end, seconds. */
  end: number;
  /** Pinned world foot position held across the run (`y` = ground plane). */
  position: IAutoMovieVector3;
}

/**
 * A foot-corrected motion plus the stance runs that were pinned — the plant
 * data a later continuous-state pass (#597) can hand off between beats.
 *
 * @author Samchon
 */
export interface IAutoMoviePlantedFeet {
  /** The corrected clip: dense keyframes at the pass sample rate. */
  motion: IAutoMovieMotion;
  /** Every pinned stance run, in detection order. */
  plants: IAutoMovieFootPlant[];
}

/**
 * The deterministic ground-IK pass: plant each leg's stance foot so a baked
 * gait no longer skates or sinks. It samples the motion on a fixed clock,
 * detects each foot's **stance runs** (frames where the foot is at or below the
 * ground plane, mirroring {@link validateGroundContact}'s `y <= groundY +
 * tolerance`), pins the foot's world XZ to its stance-start contact — with `y`
 * snapped to the ground plane — across the whole run, and re-solves the leg
 * (thigh/shin via {@link solveTwoBoneIK}, ankle toward the pinned target) so the
 * foot holds still while the hip travels over it. The correction is lowered
 * into the leg's bone-local clinical angles the way {@link reachPose} lowers an
 * arm, rooted at the **current posed hip** (not rest) so it composes on top of
 * the gait's root travel and torso motion. An unreachable pin extends the leg
 * fully toward it (foot stops on the reachable shell) rather than producing
 * NaN.
 *
 * The corrected clip is re-keyed densely at the pass sample rate; sampled at
 * those times a stance foot's world XZ is constant, so it passes
 * {@link validateFootSkate} and {@link validateGroundContact} where the raw gait
 * failed. Swing frames and non-leg joints are carried through unchanged.
 *
 * Ground is a scalar plane for now (real surfaces are #605); path/turning
 * locomotion is #599; the shared two-bone lowering could be factored out of
 * {@link reachPose} (follow-up).
 *
 * @author Samchon
 */
export const plantStanceFeet = (props: {
  /** Rig for forward kinematics. */
  skeleton: IAutoMovieSkeleton;
  /** The humanoid gait/motion to correct. */
  motion: IAutoMovieMotion;
  /** Ground plane height in world `y`. Defaults to `0`. */
  groundY?: number;
  /** Contact tolerance above the plane counted as stance. Defaults to `0.02`. */
  tolerance?: number;
  /** Legs to plant. Defaults to both humanoid legs. */
  legs?: readonly IAutoMovieFootLeg[];
  /** Samples/second for detection and re-keying. Defaults to `24`. */
  sampleRate?: number;
}): IAutoMoviePlantedFeet => {
  const groundY = props.groundY ?? DEFAULT_GROUND_Y;
  const tolerance = props.tolerance ?? DEFAULT_TOLERANCE;
  const legs = props.legs ?? DEFAULT_LEGS;
  const sampleRate = props.sampleRate ?? DEFAULT_SAMPLE_RATE;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new Error(
      `sampleRate must be a finite number > 0, but was ${sampleRate}`,
    );

  const times = sampleTimes(props.motion.duration, sampleRate);
  const poses = times.map((time) => sampleMotion(props.motion, time));
  const resolved = poses.map((sampled) =>
    resolveBoneMap(props.skeleton, sampled.pose),
  );

  // A stance run per leg: contiguous frames whose foot sits at/below ground.
  const plants: IAutoMovieFootPlant[] = [];
  // frame → leg → pinned target, so the re-key step knows what to solve.
  const targets = times.map(
    () => new Map<AutoMovieHumanoidBone, IAutoMovieVector3>(),
  );

  for (const leg of legs) {
    const contact = resolved.map((map) => {
      const foot = map.get(leg.foot);
      return foot !== undefined && foot.worldPosition.y <= groundY + tolerance;
    });
    for (const run of stanceRuns(contact)) {
      const startFoot = resolved[run.start]!.get(leg.foot)!.worldPosition;
      const target: IAutoMovieVector3 = {
        x: startFoot.x,
        y: groundY,
        z: startFoot.z,
      };
      for (let f = run.start; f <= run.end; ++f)
        targets[f]!.set(leg.foot, target);
      plants.push({
        foot: leg.foot,
        start: times[run.start]!,
        end: times[run.end]!,
        position: target,
      });
    }
  }

  const keyframes: IAutoMovieKeyframe[] = times.map((time, index) => ({
    time,
    pose: {
      skeleton: poses[index]!.pose.skeleton,
      root: poses[index]!.pose.root,
      joints: plantedJoints(
        props.skeleton,
        poses[index]!.pose,
        legs,
        targets[index]!,
      ),
    },
    expression: poses[index]!.expression,
    easing: "linear" as const,
    bezier: null,
  }));

  return {
    motion: {
      id: props.motion.id,
      skeleton: props.motion.skeleton,
      duration: props.motion.duration,
      loop: props.motion.loop,
      keyframes,
    },
    plants,
  };
};

/** Contiguous `true` runs of a contact mask, as inclusive frame ranges. */
const stanceRuns = (
  contact: readonly boolean[],
): Array<{ start: number; end: number }> => {
  const runs: Array<{ start: number; end: number }> = [];
  let start = -1;
  contact.forEach((inContact, index) => {
    if (inContact && start === -1) start = index;
    else if (!inContact && start !== -1) {
      runs.push({ start, end: index - 1 });
      start = -1;
    }
  });
  if (start !== -1) runs.push({ start, end: contact.length - 1 });
  return runs;
};

/** FK-resolve a pose into a bone → resolved-bone lookup. */
const resolveBoneMap = (
  skeleton: IAutoMovieSkeleton,
  pose: IAutoMoviePose,
): Map<AutoMovieHumanoidBone, IAutoMovieResolvedBone> =>
  new Map(resolvePose(pose, skeleton).map((bone) => [bone.bone, bone]));

/**
 * The frame's joints with every pinned leg re-solved onto its target: planted
 * legs get their {@link solveLegPlant} articulation, everything else is carried
 * through unchanged.
 */
const plantedJoints = (
  skeleton: IAutoMovieSkeleton,
  pose: IAutoMoviePose,
  legs: readonly IAutoMovieFootLeg[],
  targets: ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>,
): IAutoMovieJointPose[] => {
  let joints = pose.joints;
  for (const leg of legs) {
    const target = targets.get(leg.foot);
    if (target === undefined) continue;
    const solved = solveLegPlant(skeleton, pose, leg, target);
    if (solved === null) continue;
    joints = [
      ...joints.filter((j) => j.bone !== leg.upper && j.bone !== leg.lower),
      solved.upper,
      solved.lower,
    ];
  }
  return joints;
};

const inverse = (q: IAutoMovieQuaternion): IAutoMovieQuaternion =>
  Quaternion.normalize({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

/**
 * Two-bone IK for one leg: the thigh + shin articulation that lands `foot` on
 * the pinned world `target`, rooted at the leg's **current posed hip**. Mirrors
 * {@link reachPose}'s lowering (world delta → bone-local clinical angles) but
 * reads the chain from the current pose with the leg zeroed, so the correction
 * composes on top of the gait's root/torso motion. Legs use the default
 * clinical basis. Returns `null` for a missing or degenerate leg.
 */
const solveLegPlant = (
  skeleton: IAutoMovieSkeleton,
  pose: IAutoMoviePose,
  leg: IAutoMovieFootLeg,
  target: IAutoMovieVector3,
): { upper: IAutoMovieJointPose; lower: IAutoMovieJointPose } | null => {
  // The leg at rest under the current parent pose: zero its own articulation so
  // the recovered world rotations carry the hip/torso pose but not the leg's.
  const zeroed: IAutoMoviePose = {
    skeleton: pose.skeleton,
    root: pose.root,
    joints: pose.joints.filter(
      (j) => j.bone !== leg.upper && j.bone !== leg.lower,
    ),
  };
  const map = resolveBoneMap(skeleton, zeroed);
  const upper = map.get(leg.upper);
  const lower = map.get(leg.lower);
  const foot = map.get(leg.foot);
  if (upper === undefined || lower === undefined || foot === undefined)
    return null;

  const hip = upper.worldPosition;
  const l1 = Vector3.length(Vector3.subtract(lower.worldPosition, hip));
  const l2 = Vector3.length(
    Vector3.subtract(foot.worldPosition, lower.worldPosition),
  );
  if (l1 < 1e-6 || l2 < 1e-6) return null;
  const restUpperDir = Vector3.normalize(
    Vector3.subtract(lower.worldPosition, hip),
  );
  const restForeDir = Vector3.normalize(
    Vector3.subtract(foot.worldPosition, lower.worldPosition),
  );

  const reach = Vector3.subtract(target, hip);
  const dist = Vector3.length(reach);
  if (dist < 1e-6) return null;
  const axis = Vector3.normalize(reach);

  const { lift } = solveTwoBoneIK(l1, l2, dist);
  let normal = Vector3.cross(axis, POLE);
  if (Vector3.length(normal) < 1e-6)
    normal = Vector3.cross(axis, { x: 0, y: 0, z: 1 });
  normal = Vector3.normalize(normal);

  const upperDir = Quaternion.rotateVector(
    Quaternion.fromAxisAngle(normal, lift),
    axis,
  );
  const knee = Vector3.add(hip, Vector3.scale(upperDir, l1));
  const foreDir = Vector3.normalize(Vector3.subtract(target, knee));

  const rsu = upper.worldRotation;
  const du = aimRotation(restUpperDir, upperDir);
  const articU = Quaternion.multiply(
    inverse(rsu),
    Quaternion.multiply(du, rsu),
  );

  const rsl = lower.worldRotation;
  const rslInv = inverse(rsl);
  const localFore = Quaternion.rotateVector(rslInv, restForeDir);
  const localGoal = Quaternion.rotateVector(
    rslInv,
    Quaternion.rotateVector(inverse(du), foreDir),
  );
  const articL = aimRotation(localFore, localGoal);

  return {
    upper: { bone: leg.upper, ...decomposeJointRotation(articU) },
    lower: { bone: leg.lower, ...decomposeJointRotation(articL) },
  };
};

const sampleTimes = (duration: number, sampleRate: number): number[] => {
  const frames = Math.max(1, Math.ceil(duration * sampleRate));
  return Array.from({ length: frames + 1 }, (_, index) =>
    Math.min(duration, index / sampleRate),
  );
};
