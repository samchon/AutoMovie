import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieJointAxes } from "../kinematics/jointToQuaternion";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { groundFunction } from "../space/ground";
import { pinStanceTargets } from "./groundPins";
import {
  HUMANOID_LEG_CHAINS,
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
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Declares the articulated chain whose foot is judged against the ground contact.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Defines one support limb for stance detection and correction.
 * @author Samchon
 */
export interface IAutoMovieFootLeg {
  /**
   * Foot end-effector bone (the ground-contact point that is pinned).
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Identifies the bone whose world position is constrained to the ground target.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Selects the effector that supplies and receives support.
   */
  foot: AutoMovieHumanoidBone;
  /**
   * Upper leg segment (thigh): the chain root.
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Anchors the leg correction at its declared proximal segment.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Establishes the first link that transfers the planted support.
   */
  upper: AutoMovieHumanoidBone;
  /**
   * Lower leg segment (shin).
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Identifies the hinge segment adjusted to keep the foot on its target.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Establishes the second articulated link in the support solve.
   */
  lower: AutoMovieHumanoidBone;
}

/**
 * The humanoid legs, named from the shared chain table so the ground-IK pass
 * and the retarget contact pass cannot disagree about which bones a leg is.
 */
const DEFAULT_LEGS: readonly IAutoMovieFootLeg[] = HUMANOID_LEG_CHAINS.map(
  (chain) => ({
    foot: chain.effector,
    upper: chain.upper,
    lower: chain.lower,
  }),
);

/**
 * One planted-foot stance run the pass detected and pinned: the foot stayed on
 * the ground from `start` to `end` and its world position was held at
 * `position` (its `y` snapped to the ground plane).
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases Records one contiguous planted phase and its authoritative support point.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Makes the detected support interval and target inspectable.
 * @author Samchon
 */
export interface IAutoMovieFootPlant {
  /**
   * The planted foot bone.
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases Associates the planted phase with its contacting effector.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Identifies which support limb owns the interval.
   */
  foot: AutoMovieHumanoidBone;
  /**
   * Inclusive stance-run start, seconds.
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases Marks the sample at which the foot enters its planted phase.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Uses this instant as the inclusive lower boundary of support sampling.
   */
  start: number;
  /**
   * Inclusive stance-run end, seconds.
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases Marks the last sample owned by the planted phase before release.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Includes this final instant in the planted phase before release.
   */
  end: number;
  /**
   * Pinned world foot position held across the run (`y` = ground height).
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Carries the authoritative world target and its ground height.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Defines the support point held throughout the planted interval.
   */
  position: IAutoMovieVector3;
}

/**
 * A foot-corrected motion plus the stance runs that were pinned, the plant data
 * a later continuous-state pass (#597) can hand off between beats.
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases Couples corrected motion to the planted intervals it must preserve.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Returns the resolved performance and its support record together.
 * @author Samchon
 */
export interface IAutoMoviePlantedFeet {
  /**
   * The corrected clip: dense keyframes at the pass sample rate.
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases Bakes each planted phase into the articulated pose sequence.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Provides the motion after support constraints are resolved.
   */
  motion: IAutoMovieMotion;
  /**
   * Every pinned stance run, in detection order.
   *
   * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases Preserves the ordered contact intervals detected on the fixed sample grid.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Exposes the support history that explains the corrected clip.
   */
  plants: IAutoMovieFootPlant[];
}

/**
 * The deterministic ground-IK pass: plant each leg's stance foot so a baked
 * gait no longer skates or sinks. It samples the motion on a fixed clock,
 * detects each foot's **stance runs** (frames where the foot is at or below the
 * ground plane, mirroring {@link validateGroundContact}'s `y <= groundY +
 * tolerance`), pins the foot's world XZ to its stance-start contact, with `y`
 * snapped to the ground plane, across the whole run, and re-solves the leg
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
 * Imported or non-canonical rigs pass the same `jointAxes` and `restFrames`
 * used for playback: stance detection, IK decomposition, ROM clamping, and
 * residual FK then share one clinical contract.
 *
 * Ground is a scalar plane or a `(x, z) → y` source. Plug a space in via
 * {@link spaceGround} (#605). Path/turning locomotion is #599; the shared
 * two-bone lowering could be factored out of {@link reachPose} (follow-up).
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Detects stance against the declared ground and tolerance, then pins each run to its contact target.
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-refusal Bounds an unreachable stance correction at the limb's reachable shell instead of emitting non-finite motion.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Resolves planted support into ROM-bounded dense motion and an explicit contact record.
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
  /** Optional clinical-axis remap used consistently by detection and IK. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  /** Optional clinical rest frames used consistently by detection and IK. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
  /** Samples/second for detection and re-keying. Defaults to `24`. */
  sampleRate?: number;
  /**
   * Prior beat plants expressed in this motion's model frame.
   *
   * When a detected stance begins at the opening sample, its first pin resumes
   * this authoritative position instead of deriving a nearby replacement.
   */
  openingPlants?: ReadonlyArray<Pick<IAutoMovieFootPlant, "foot" | "position">>;
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
    resolveBoneMap(
      props.skeleton,
      sampled.pose,
      undefined,
      props.jointAxes,
      props.restFrames,
    ),
  );

  // A stance run per leg pinned to its start contact; per-frame solve targets.
  const { plants, targets } = pinStanceTargets({
    legs,
    resolved,
    times,
    groundAt,
    tolerance,
    openingTargets: new Map(
      (props.openingPlants ?? []).map((plant) => [plant.foot, plant.position]),
    ),
  });

  const keyframes = rekeyPlantedFeet({
    skeleton: props.skeleton,
    times,
    poses,
    legs,
    targets,
    jointAxes: props.jointAxes,
    restFrames: props.restFrames,
  });

  return assemblePlantedFeet(props.motion, keyframes, plants);
};
