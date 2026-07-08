import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieJointAxes, resolvePose } from "../kinematics";
import { segmentSegmentDistance } from "../math/segments";
import { sampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { IAutoMovieCapsuleProxy, validateCapsule } from "./capsuleProxy";
import { ViolationCollector } from "./violation";

const DEFAULT_SAMPLE_RATE = 24;

/**
 * Explicit capsule pair to test for overlap.
 *
 * Pairing is explicit because adjacent anatomical capsules often share joints
 * and should not be treated as self-intersections.
 *
 * @author Samchon
 */
export interface IAutoMovieCapsuleProxyPair {
  /** First capsule in the pair. */
  first: IAutoMovieCapsuleProxy;

  /** Second capsule in the pair. */
  second: IAutoMovieCapsuleProxy;
}

/**
 * Tier-3 self-intersection check over declared capsule proxy pairs. It samples
 * the motion, resolves FK, and rejects frames where the two capsule centerlines
 * are closer than the sum of their radii.
 *
 * The validator is intentionally proxy-driven: callers choose non-adjacent body
 * parts that should not overlap, while mesh topology remains a later Tier-5
 * concern.
 *
 * @author Samchon
 */
export const validateSelfIntersection = (props: {
  /** Motion clip to sample. */
  motion: IAutoMovieMotion;

  /** Skeleton used for forward kinematics. */
  skeleton: IAutoMovieSkeleton;

  /** Declared non-adjacent capsule pairs to test. */
  pairs: readonly IAutoMovieCapsuleProxyPair[];

  /** Samples per second used by the validator. Defaults to `24`. */
  sampleRate?: number;

  /** JSON path of the proxy annotation being checked. Defaults to `$input`. */
  path?: string;

  /** Optional clinical-axis remap for rigs authored in semantic axes. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /** Optional rest-frame remap for clinical authoring. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}): IAutoMovieValidation => {
  const collector = new ViolationCollector();
  const sampleRate =
    props.sampleRate === undefined ? DEFAULT_SAMPLE_RATE : props.sampleRate;
  const path = props.path ?? "$input";
  const skeletonBones = new Set(props.skeleton.bones.map((bone) => bone.bone));

  if (!Number.isFinite(sampleRate))
    return rejectSampleRate(collector, path, sampleRate);
  if (sampleRate <= 0) return rejectSampleRate(collector, path, sampleRate);

  props.pairs.forEach((pair, pairIndex) => {
    const pp = `${path}.pairs[${pairIndex}]`;
    const firstValid = validateCapsule(
      pair.first,
      `${pp}.first`,
      skeletonBones,
      collector,
    );
    const secondValid = validateCapsule(
      pair.second,
      `${pp}.second`,
      skeletonBones,
      collector,
    );
    if (firstValid && secondValid) {
      sampleTimes(props.motion.duration, sampleRate).forEach(
        (time, sampleIndex) => {
          const resolved = new Map(
            resolvePose(
              sampleMotion(props.motion, time).pose,
              props.skeleton,
              props.jointAxes,
              props.restFrames,
            ).map((bone) => [bone.bone, bone.worldPosition]),
          );
          const first = resolveCapsule(pair.first, resolved);
          const second = resolveCapsule(pair.second, resolved);
          const distance = segmentSegmentDistance(
            first.from,
            first.to,
            second.from,
            second.to,
          );
          const minimum = pair.first.radius + pair.second.radius;
          if (distance < minimum)
            collector.push(
              "physics",
              `${pp}.samples[${sampleIndex}].distance`,
              `capsule centerline distance must stay >= ${round(minimum)}m at t=${round(time)}s`,
              distance,
              minimum - distance,
            );
        },
      );
    }
  });

  return collector.toValidation();
};

const rejectSampleRate = (
  collector: ViolationCollector,
  path: string,
  sampleRate: number,
): IAutoMovieValidation => {
  collector.push(
    "range",
    `${path}.sampleRate`,
    `sampleRate must be a finite number > 0, but was ${sampleRate}`,
    sampleRate,
  );
  return collector.toValidation();
};

const resolveCapsule = (
  capsule: IAutoMovieCapsuleProxy,
  resolved: ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>,
): { from: IAutoMovieVector3; to: IAutoMovieVector3 } => ({
  from: resolved.get(capsule.from)!,
  to: resolved.get(capsule.to)!,
});

const round = (value: number): number => Math.round(value * 1_000) / 1_000;
