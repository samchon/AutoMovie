import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieJointAxes, resolvePose } from "../kinematics";
import { convexHull2D, pointHullDistance } from "../math/hull";
import { sampleMotion } from "../motion/sampleMotion";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { ViolationCollector } from "./violation";

const DEFAULT_CENTER_BONE = "hips";
const DEFAULT_MARGIN = 0.02;
const DEFAULT_SAMPLE_RATE = 24;
const CENTER_BONE_EXPECTED = "center bone must exist in the target skeleton";
const MARGIN_EXPECTED = "margin must be a finite number >= 0";
const SUPPORT_BONES_EXPECTED =
  "supportBones must contain at least one contact bone";
const SUPPORT_BONE_EXPECTED = "support bone must exist in the target skeleton";

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
 * This validator is deliberately a hard rejection signal, not an auto-fixer:
 * moving the root, widening the stance, or changing the action are different
 * authoring decisions that belong upstream.
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
}): IAutoMovieValidation => {
  const collector = new ViolationCollector();
  const sampleRate =
    props.sampleRate === undefined ? DEFAULT_SAMPLE_RATE : props.sampleRate;
  const sampleRateValid = isPositiveFinite(sampleRate);
  const path = props.path ?? "$input";
  const skeletonBones = new Set(props.skeleton.bones.map((bone) => bone.bone));

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
    const emptySupport = support.supportBones.length === 0;
    let missingSupport = false;
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
    if (emptySupport)
      collector.push(
        "type",
        `${sp}.supportBones`,
        SUPPORT_BONES_EXPECTED,
        support.supportBones,
      );
    for (const bone of support.supportBones)
      if (!skeletonBones.has(bone)) {
        missingSupport = true;
        collector.push(
          "type",
          `${sp}.supportBones`,
          SUPPORT_BONE_EXPECTED,
          bone,
        );
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
      emptySupport ||
      missingSupport ||
      temporalInvalid ||
      marginInvalid
    )
      continue;

    const frames = Math.max(
      1,
      Math.ceil((support.end - support.start) * sampleRate),
    );
    for (let sampleIndex = 0; sampleIndex <= frames; sampleIndex++) {
      const sampled = support.start + sampleIndex / sampleRate;
      const time = sampled > support.end ? support.end : sampled;
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
      if (distance > margin) {
        const roundedMargin = round(margin);
        const roundedTime = round(time);
        const overshoot = distance - margin;
        const expected = `center-of-mass projection must stay within support hull margin ${roundedMargin}m at t=${roundedTime}s`;
        const violationPath = `${sp}.samples[${sampleIndex}].centerOfMass.supportDistance`;
        collector.push("physics", violationPath, expected, distance, overshoot);
      }
    }
  }

  const validation = collector.toValidation();
  return validation;
};

const isPositiveFinite = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
