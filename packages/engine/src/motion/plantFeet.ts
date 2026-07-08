import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { groundFunction } from "../space/ground";
import { pinStanceTargets } from "./groundPins";
import {
  assemblePlantedFeet,
  rekeyPlantedFeet,
  resolveBoneMap,
} from "./legPlant";
import { sampleTimes } from "./sampleClock";
import { sampleMotion } from "./sampleMotion";

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
  /** Pinned world foot position held across the run (`y` = ground height). */
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
 * Ground is a scalar plane or a `(x, z) → y` source — plug a space in via
 * {@link spaceGround} (#605). Path/turning locomotion is #599; the shared
 * two-bone lowering could be factored out of {@link reachPose} (follow-up).
 *
 * @author Samchon
 */
export const plantStanceFeet = (props: {
  /** Rig for forward kinematics. */
  skeleton: IAutoMovieSkeleton;
  /** The humanoid gait/motion to correct. */
  motion: IAutoMovieMotion;
  /** Ground height: plane scalar or `(x, z) → y` source. Defaults to `0`. */
  groundY?: number | ((x: number, z: number) => number);
  /** Contact tolerance above the plane counted as stance. Defaults to `0.02`. */
  tolerance?: number;
  /** Legs to plant. Defaults to both humanoid legs. */
  legs?: readonly IAutoMovieFootLeg[];
  /** Samples/second for detection and re-keying. Defaults to `24`. */
  sampleRate?: number;
}): IAutoMoviePlantedFeet => {
  const groundAt = groundFunction(props.groundY ?? DEFAULT_GROUND_Y);
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

  // A stance run per leg pinned to its start contact; per-frame solve targets.
  const { plants, targets } = pinStanceTargets({
    legs,
    resolved,
    times,
    groundAt,
    tolerance,
  });

  const keyframes = rekeyPlantedFeet({
    skeleton: props.skeleton,
    times,
    poses,
    legs,
    targets,
  });

  return assemblePlantedFeet(props.motion, keyframes, plants);
};
