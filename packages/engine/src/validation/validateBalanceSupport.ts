import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieJointAxes, resolvePose } from "../kinematics";
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
      const [firstSupportBone, ...remainingSupportBones] = support.supportBones;
      const firstSupport = resolved.get(firstSupportBone!)!;
      let distance = 0;
      switch (remainingSupportBones.length) {
        case 0:
          distance = pointDistance(centerPosition, firstSupport);
          break;
        case 1: {
          const secondSupport = resolved.get(remainingSupportBones[0]!)!;
          distance = pointSegmentDistance(
            centerPosition,
            firstSupport,
            secondSupport,
          );
          break;
        }
        default: {
          const secondSupport = resolved.get(remainingSupportBones[0]!)!;
          const hull = [];
          hull[0] = firstSupport;
          hull[1] = secondSupport;
          for (const bone of remainingSupportBones.slice(1)) {
            const supportPosition = resolved.get(bone)!;
            hull.push(supportPosition);
          }
          if (isInsideConvexPolygon(centerPosition, hull)) distance = 0;
          else distance = edgeDistances(centerPosition, hull);
          break;
        }
      }
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

const isInsideConvexPolygon = (
  point: IAutoMovieVector3,
  polygon: readonly IAutoMovieVector3[],
): boolean => {
  let sign = 0;
  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const cross =
      (end.x - start.x) * (point.z - start.z) -
      (end.z - start.z) * (point.x - start.x);
    const side = sideOf(cross);
    if (side === 0) continue;
    if (sign === 0) {
      sign = side;
      continue;
    }
    if (sign !== side) return false;
  }
  return true;
};

const edgeDistances = (
  point: IAutoMovieVector3,
  polygon: readonly IAutoMovieVector3[],
): number => {
  const distances = polygon.map((start, index) =>
    pointSegmentDistance(point, start, polygon[(index + 1) % polygon.length]!),
  );
  return Math.min(...distances);
};

const pointSegmentDistance = (
  point: IAutoMovieVector3,
  start: IAutoMovieVector3,
  end: IAutoMovieVector3,
): number => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const span = Math.max(dx * dx + dz * dz, Number.EPSILON);
  const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / span);
  const x = start.x + (end.x - start.x) * t;
  const z = start.z + (end.z - start.z) * t;
  return Math.hypot(point.x - x, point.z - z);
};

const pointDistance = (a: IAutoMovieVector3, b: IAutoMovieVector3): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

const sideOf = (value: number): number => {
  if (value < 0) return -1;
  if (value > 0) return 1;
  return 0;
};

const isPositiveFinite = (value: number): boolean =>
  Number.isFinite(value) && value > 0;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
