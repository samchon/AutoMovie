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
import {
  IAutoMovieFootLeg,
  IAutoMovieFootPlant,
  IAutoMoviePlantedFeet,
} from "./plantFeet";
import { sampleMotion } from "./sampleMotion";

/** World-down, the pole a natural knee bends away from (as {@link reachPose}). */
const POLE: IAutoMovieVector3 = { x: 0, y: -1, z: 0 };

/**
 * Re-key the sampled frames densely, re-solving every pinned leg onto its
 * stance target — the assembly stage of {@link plantStanceFeet}.
 */
export const rekeyPlantedFeet = (props: {
  skeleton: IAutoMovieSkeleton;
  times: readonly number[];
  poses: ReadonlyArray<ReturnType<typeof sampleMotion>>;
  legs: readonly IAutoMovieFootLeg[];
  targets: ReadonlyArray<ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>>;
}): IAutoMovieKeyframe[] =>
  props.times.map((time, index) => ({
    time,
    pose: {
      skeleton: props.poses[index]!.pose.skeleton,
      root: props.poses[index]!.pose.root,
      joints: plantedJoints(
        props.skeleton,
        props.poses[index]!.pose,
        props.legs,
        props.targets[index]!,
      ),
    },
    expression: props.poses[index]!.expression,
    easing: "linear" as const,
    bezier: null,
  }));

/** Wrap the corrected keyframes + plants as the pass result. */
export const assemblePlantedFeet = (
  motion: IAutoMovieMotion,
  keyframes: IAutoMovieKeyframe[],
  plants: IAutoMovieFootPlant[],
): IAutoMoviePlantedFeet => ({
  motion: {
    id: motion.id,
    skeleton: motion.skeleton,
    duration: motion.duration,
    loop: motion.loop,
    keyframes,
  },
  plants,
});

/** FK-resolve a pose into a bone → resolved-bone lookup. */
export const resolveBoneMap = (
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
