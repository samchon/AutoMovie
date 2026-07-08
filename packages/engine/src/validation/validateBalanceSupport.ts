import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieJointAxes, resolvePose } from "../kinematics";
import { convexHull2D, pointHullDistance } from "../math/hull";
import { windowSampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { fkReachableBones } from "./fkReachableBones";
import { ViolationCollector } from "./violation";

const DEFAULT_CENTER_BONE = "hips";
const DEFAULT_MARGIN = 0.02;
const DEFAULT_SAMPLE_RATE = 24;
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
  /** Bone used as the coarse center-of-mass proxy. Defaults to `hips`. */
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
 * resolves FK, projects the center bone and support contacts to the XZ plane,
 * and rejects frames where the center-of-mass proxy falls outside the support
 * hull plus margin.
 *
 * Balance is a physical-plausibility **warning**, not a gate (D015): overstated
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
   * Marker that opts the clip out of the balance expectation (D015): a
   * deliberately off-balance pose (wire-fu, a mid-spin freeze, a tiptoe) sets
   * this and the matching warnings are suppressed.
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
  const reachableBones = fkReachableBones(props.skeleton);

  if (!sampleRateValid)
    collector.push(
      "range",
      `${path}.sampleRate`,
      `sampleRate must be a finite number > 0, but was ${sampleRate}`,
      sampleRate,
    );

  for (const [supportIndex, support] of props.supports.entries()) {
    const sp = `${path}.supports[${supportIndex}]`;
    const centerBone = support.centerBone ?? DEFAULT_CENTER_BONE;
    const margin = support.margin ?? DEFAULT_MARGIN;
    const centerMissing = !skeletonBones.has(centerBone);
    // A declared-but-detached bone (its parent chain never reaches a root) is
    // never returned by FK, so reading its resolved position would crash rather
    // than report the malformed rig. Gate on FK-reachability, not just
    // declaration.
    const centerUnreachable =
      skeletonBones.has(centerBone) && !reachableBones.has(centerBone);
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

    // The engine's shared sampling grid (endpoint-inclusive, end-clamped) —
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
      );
      for (const bone of pose) resolved.set(bone.bone, bone.worldPosition);
      const centerPosition = resolved.get(centerBone) as IAutoMovieVector3;
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

const isPositiveFinite = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
