import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  IAutoMovieJointAxes,
  indexSkeletonTopology,
  resolvePose,
} from "../kinematics";
import { convexHull2D, pointHullDistance } from "../math/hull";
import { windowSampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { fkReachableBones } from "./fkReachableBones";
import { ViolationCollector } from "./violation";

const DEFAULT_MARGIN = 0.02;
const DEFAULT_SAMPLE_RATE = 24;

/**
 * Segment mass as a fraction of total body mass, per load-bearing bone (Winter,
 * "Biomechanics and Motor Control of Human Movement"). Only the ratios matter:
 * the whole-body COM is a weighted mean, so any consistent scaling yields the
 * same point. Bones absent from this table (clavicles, toes, eyes, jaw,
 * fingers) carry {@link DEFAULT_SEGMENT_MASS_FRACTION}, and the mean
 * renormalizes over whichever bones a rig actually resolves, so an omitted
 * `upperChest`/`neck` never biases the result.
 */
const SEGMENT_MASS_FRACTION: Partial<Record<AutoMovieHumanoidBone, number>> = {
  hips: 14.2,
  spine: 13.9,
  chest: 15.6,
  upperChest: 6.0,
  neck: 1.1,
  head: 7.0,
  leftUpperArm: 2.8,
  rightUpperArm: 2.8,
  leftLowerArm: 1.6,
  rightLowerArm: 1.6,
  leftHand: 0.6,
  rightHand: 0.6,
  leftUpperLeg: 10.0,
  rightUpperLeg: 10.0,
  leftLowerLeg: 4.65,
  rightLowerLeg: 4.65,
  leftFoot: 1.45,
  rightFoot: 1.45,
};

/** Mass fraction for a minor bone the table omits (clavicle, toe, eye, finger). */
const DEFAULT_SEGMENT_MASS_FRACTION = 0.2;
const CENTER_BONE_EXPECTED = "center bone must exist in the target skeleton";
const CENTER_BONE_REACHABLE =
  "center bone is declared but not reachable from a root bone via forward kinematics";
const MARGIN_EXPECTED = "margin must be a finite number >= 0";
const SUPPORT_BONES_EXPECTED =
  "supportBones must contain at least one contact bone";
const SUPPORT_BONE_EXPECTED = "support bone must exist in the target skeleton";
const SUPPORT_BONE_REACHABLE =
  "support bone is declared but not reachable from a root bone via forward kinematics";

/**
 * Declared balance window for center-of-mass support validation.
 *
 * The support hull is explicit because stance semantics are action-level facts:
 * a jump, kneel, hand plant, or one-foot balance all need different contact
 * points even when the same skeleton is sampled.
 *
 * @author Samchon
 */
export interface IAutoMovieBalanceSupportWindow {
  /**
   * Center-of-mass source. **Omit** (the default and recommended form) to use
   * the segment-mass-weighted whole-body COM over the resolved pose,
   * trustworthy for a lean, reach, or crouch, where the real COM shifts far
   * from the pelvis. Provide a bone to override with a single-bone proxy (the
   * pre-#1184 coarse behavior) for a rig or stance where a specific point is
   * the intended COM.
   */
  centerBone?: AutoMovieHumanoidBone;

  /** Ordered support contact bones projected onto the horizontal XZ plane. */
  supportBones: readonly AutoMovieHumanoidBone[];

  /** Inclusive start time in seconds. */
  start: number;

  /** Inclusive end time in seconds. */
  end: number;

  /** Allowed projected COM distance outside the support hull in meters. */
  margin?: number;
}

/**
 * Tier-3 balance check over declared support windows. It samples a motion,
 * resolves FK, computes the segment-mass-weighted whole-body center of mass (or
 * a single-bone proxy when `centerBone` is set), projects it and the support
 * contacts to the XZ plane, and rejects frames where the COM falls outside the
 * support hull plus margin.
 *
 * Balance is a physical-plausibility **warning**, not a gate: overstated
 * action, martial arts, dance, and stunts are built on momentary imbalance (a
 * launch, a landing, a spin, a tiptoe, an airborne pose), so the run still
 * succeeds and the warning surfaces for the orchestrator to restage or
 * acknowledge with `physicsIntent`. Only malformed windows (bad/detached bone,
 * empty support, bad window/margin) are errors.
 *
 * @author Samchon
 */
export const validateBalanceSupport = (props: {
  /** Motion clip to sample. */
  motion: IAutoMovieMotion;

  /** Skeleton used for forward kinematics. */
  skeleton: IAutoMovieSkeleton;

  /** Declared support windows to test. */
  supports: readonly IAutoMovieBalanceSupportWindow[];

  /** Samples per second used by the validator. Defaults to `24`. */
  sampleRate?: number;

  /** JSON path of the support annotation being checked. Defaults to `$input`. */
  path?: string;

  /** Optional clinical-axis remap for rigs authored in semantic axes. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /** Optional rest-frame remap for clinical authoring. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;

  /**
   * Marker that opts the clip out of the balance expectation: a deliberately
   * off-balance pose (wire-fu, a mid-spin freeze, a tiptoe) sets this and the
   * matching warnings are suppressed.
   */
  physicsIntent?: string;
}): IAutoMovieValidation => {
  const collector = new ViolationCollector();
  const suppressed = props.physicsIntent !== undefined;
  const sampleRate =
    props.sampleRate === undefined ? DEFAULT_SAMPLE_RATE : props.sampleRate;
  const sampleRateValid = isPositiveFinite(sampleRate);
  const path = props.path ?? "$input";
  const skeletonBones = new Set(props.skeleton.bones.map((bone) => bone.bone));
  const topology = indexSkeletonTopology(props.skeleton);
  const reachableBones = fkReachableBones(props.skeleton, topology);

  if (!sampleRateValid)
    collector.push(
      "range",
      `${path}.sampleRate`,
      `sampleRate must be a finite number > 0, but was ${sampleRate}`,
      sampleRate,
    );

  for (const [supportIndex, support] of props.supports.entries()) {
    const sp = `${path}.supports[${supportIndex}]`;
    const centerBone = support.centerBone;
    const margin = support.margin ?? DEFAULT_MARGIN;
    // A single-bone override is validated for membership/reachability; the
    // default whole-body COM reads every resolved bone and needs no such gate.
    const centerMissing =
      centerBone !== undefined && !skeletonBones.has(centerBone);
    // A declared-but-detached bone (its parent chain never reaches a root) is
    // never returned by FK, so reading its resolved position would crash rather
    // than report the malformed rig. Gate on FK-reachability, not just
    // declaration.
    const centerUnreachable =
      centerBone !== undefined &&
      skeletonBones.has(centerBone) &&
      !reachableBones.has(centerBone);
    const emptySupport = support.supportBones.length === 0;
    let missingSupport = false;
    let unreachableSupport = false;
    const temporalInvalid =
      !Number.isFinite(support.start) ||
      !Number.isFinite(support.end) ||
      support.end <= support.start;
    const marginInvalid = !Number.isFinite(margin) || margin < 0;

    if (centerMissing)
      collector.push(
        "type",
        `${sp}.centerBone`,
        CENTER_BONE_EXPECTED,
        centerBone,
      );
    if (centerUnreachable)
      collector.push(
        "type",
        `${sp}.centerBone`,
        CENTER_BONE_REACHABLE,
        centerBone,
      );
    if (emptySupport)
      collector.push(
        "type",
        `${sp}.supportBones`,
        SUPPORT_BONES_EXPECTED,
        support.supportBones,
      );
    for (const bone of support.supportBones) {
      if (!skeletonBones.has(bone)) {
        missingSupport = true;
        collector.push(
          "type",
          `${sp}.supportBones`,
          SUPPORT_BONE_EXPECTED,
          bone,
        );
      } else if (!reachableBones.has(bone)) {
        unreachableSupport = true;
        collector.push(
          "type",
          `${sp}.supportBones`,
          SUPPORT_BONE_REACHABLE,
          bone,
        );
      }
    }
    if (temporalInvalid)
      collector.push(
        "temporal",
        sp,
        `support window must have finite start/end with end > start, but was [${support.start}, ${support.end}]`,
        { start: support.start, end: support.end },
      );
    if (marginInvalid)
      collector.push("range", `${sp}.margin`, MARGIN_EXPECTED, margin);
    if (
      !sampleRateValid ||
      centerMissing ||
      centerUnreachable ||
      emptySupport ||
      missingSupport ||
      unreachableSupport ||
      temporalInvalid ||
      marginInvalid
    )
      continue;

    // The engine's shared sampling grid (endpoint-inclusive, end-clamped):
    // the same clock footskate/ground/self-intersection step, so the physics
    // validators can never drift onto different frame boundaries.
    const times = windowSampleTimes(support.start, support.end, sampleRate);
    for (let sampleIndex = 0; sampleIndex < times.length; sampleIndex++) {
      const time = times[sampleIndex]!;
      const resolved = new Map<AutoMovieHumanoidBone, IAutoMovieVector3>();
      const pose = resolvePose(
        sampleMotion(props.motion, time).pose,
        props.skeleton,
        props.jointAxes,
        props.restFrames,
        topology,
      );
      for (const bone of pose) resolved.set(bone.bone, bone.worldPosition);
      const centerPosition =
        centerBone === undefined
          ? weightedCenterOfMass(resolved)
          : (resolved.get(centerBone) as IAutoMovieVector3);
      // A real convex hull of the support contacts, so a mis-ordered or
      // non-convex support list can no longer be misclassified. Handles the
      // 1-/2-/many-point cases uniformly (a lone contact or a collinear pair
      // collapses to a point/segment inside the hull query).
      const hull = convexHull2D(
        support.supportBones.map((bone) => resolved.get(bone)!),
      );
      const distance = pointHullDistance(centerPosition, hull);
      if (distance > margin && !suppressed) {
        const roundedMargin = round(margin);
        const roundedTime = round(time);
        const overshoot = distance - margin;
        const expected = `center-of-mass projection must stay within support hull margin ${roundedMargin}m at t=${roundedTime}s (a pose may be deliberately off-balance; mark physicsIntent if it is intended)`;
        const violationPath = `${sp}.samples[${sampleIndex}].centerOfMass.supportDistance`;
        collector.warn("physics", violationPath, expected, distance, overshoot);
      }
    }
  }

  const validation = collector.toValidation();
  return validation;
};

/**
 * The whole-body center of mass: each resolved bone's world position weighted
 * by its segment mass fraction. This is a proximal-joint mass model (each
 * segment's mass sits at the bone's own joint), a v1 that is already far more
 * trustworthy than a single hips bone for a lean, reach, or crouch, where the
 * real COM shifts away from the pelvis. Sampling runs only past the
 * reachability gate, so `resolved` always holds at least the root and the total
 * weight is positive.
 */
const weightedCenterOfMass = (
  resolved: ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>,
): IAutoMovieVector3 => {
  let mass = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [bone, position] of resolved) {
    const weight = SEGMENT_MASS_FRACTION[bone] ?? DEFAULT_SEGMENT_MASS_FRACTION;
    mass += weight;
    x += weight * position.x;
    y += weight * position.y;
    z += weight * position.z;
  }
  return { x: x / mass, y: y / mass, z: z / mass };
};

const isPositiveFinite = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
