import {
  IAutoMovieCompiledFormationLod,
  IAutoMovieFormationMotion,
  IAutoMovieFormationMotionState,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "./math/Quaternion";
import { Vector3 } from "./math/Vector3";

/** Inputs to the deterministic automatic formation LOD selector. */
export interface IAutoMovieFormationLodInput {
  /** Ordered compiled anonymous representations. */
  lod: readonly IAutoMovieCompiledFormationLod[];
  /** Camera-to-chunk-centroid distance in meters. */
  distance: number;
  /** Projected representative-member diameter in physical pixels. */
  projectedPixels: number;
  /** Tier retained from the previous frame, or null on first selection. */
  previous: IAutoMovieCompiledFormationLod["tier"] | null;
  /** Fractional boundary deadband; 0.1 by default. */
  hysteresis?: number;
}

/** One automatic LOD decision with its combined selection metric. */
export interface IAutoMovieFormationLodSelection {
  /** Selected compiled tier. */
  lod: IAutoMovieCompiledFormationLod;
  /** Distance enlarged as projected contribution shrinks. */
  effectiveDistance: number;
}

/**
 * Select automatic formation LOD from distance and projected contribution.
 *
 * Twenty-four projected pixels are neutral. A prior tier retains a 10% boundary
 * deadband so camera jitter cannot thrash instance buffers.
 */
export const selectFormationLod = (
  input: IAutoMovieFormationLodInput,
): IAutoMovieFormationLodSelection => {
  if (input.lod.length === 0)
    throw new Error("A compiled formation requires at least one LOD tier.");
  const projectedPixels = Math.max(1, input.projectedPixels);
  const effectiveDistance = input.distance * (24 / projectedPixels);
  const matchedIndex = input.lod.findIndex(
    (lod) => lod.maxDistance === null || effectiveDistance <= lod.maxDistance,
  );
  const desiredIndex = matchedIndex < 0 ? input.lod.length - 1 : matchedIndex;
  const previousIndex = input.lod.findIndex(
    (lod) => lod.tier === input.previous,
  );
  if (previousIndex < 0 || previousIndex === desiredIndex)
    return { lod: input.lod[desiredIndex]!, effectiveDistance };
  const hysteresis = input.hysteresis ?? 0.1;
  if (desiredIndex > previousIndex) {
    const boundary = input.lod[previousIndex]!.maxDistance!;
    if (effectiveDistance <= boundary * (1 + hysteresis))
      return { lod: input.lod[previousIndex]!, effectiveDistance };
  } else {
    const boundary = input.lod[desiredIndex]!.maxDistance!;
    if (effectiveDistance >= boundary * (1 - hysteresis))
      return { lod: input.lod[previousIndex]!, effectiveDistance };
  }
  return { lod: input.lod[desiredIndex]!, effectiveDistance };
};

/** Sample one formation's compact source-authored cue sequence. */
export const sampleFormationMotion = (
  motions: readonly IAutoMovieFormationMotion[],
  formation: string,
  time: number,
): IAutoMovieFormationMotionState => {
  const cues = motions
    .filter((cue) => cue.formation === formation)
    .sort(
      (left, right) =>
        left.start - right.start ||
        (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    );
  const identity: IAutoMovieFormationMotionState = {
    translation: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  };
  if (cues.length === 0 || time < cues[0]!.start) return identity;
  let retained = cues[0]!.from;
  for (const cue of cues) {
    if (time < cue.start) return retained;
    if (time < cue.end) {
      const progress = easingProgress(
        cue.easing,
        Math.max(0, Math.min(1, (time - cue.start) / (cue.end - cue.start))),
      );
      return {
        translation: {
          x: lerp(cue.from.translation.x, cue.to.translation.x, progress),
          y: lerp(cue.from.translation.y, cue.to.translation.y, progress),
          z: lerp(cue.from.translation.z, cue.to.translation.z, progress),
        },
        facingOffsetDeg: lerp(
          cue.from.facingOffsetDeg,
          cue.to.facingOffsetDeg,
          progress,
        ),
        spacingScale: {
          lateral: lerp(
            cue.from.spacingScale.lateral,
            cue.to.spacingScale.lateral,
            progress,
          ),
          depth: lerp(
            cue.from.spacingScale.depth,
            cue.to.spacingScale.depth,
            progress,
          ),
        },
      };
    }
    retained = cue.to;
  }
  return retained;
};

/** Apply a sampled formation state to one designed world-space point. */
export const transformFormationPoint = (
  point: IAutoMovieVector3,
  anchor: IAutoMovieVector3,
  motion: IAutoMovieFormationMotionState,
  baseFacingDeg = 0,
): IAutoMovieVector3 => {
  const baseRadians = (baseFacingDeg * Math.PI) / 180;
  const baseCosine = Math.cos(baseRadians);
  const baseSine = Math.sin(baseRadians);
  const deltaX = point.x - anchor.x;
  const deltaZ = point.z - anchor.z;
  const localX =
    (deltaX * baseCosine - deltaZ * baseSine) * motion.spacingScale.lateral;
  const localZ =
    (deltaX * baseSine + deltaZ * baseCosine) * motion.spacingScale.depth;
  const radians = ((baseFacingDeg + motion.facingOffsetDeg) * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: anchor.x + motion.translation.x + localX * cosine + localZ * sine,
    y: point.y + motion.translation.y,
    z: anchor.z + motion.translation.z - localX * sine + localZ * cosine,
  };
};

/**
 * Compose a promoted hero's source-authored node transform with formation
 * placement and motion.
 *
 * Translation keeps authored node/object-motion displacement relative to the
 * compiler-owned hero slot. Rotation applies the current formation facing
 * before the authored rotation relative to that slot, while scale remains
 * source-owned.
 */
export const composeFormationHeroTransform = (
  base: IAutoMovieTransform,
  source: IAutoMovieTransform,
  anchor: IAutoMovieVector3,
  motion: IAutoMovieFormationMotionState,
  baseFacingDeg = 0,
): IAutoMovieTransform => ({
  translation: Vector3.add(
    transformFormationPoint(base.translation, anchor, motion, baseFacingDeg),
    Vector3.subtract(source.translation, base.translation),
  ),
  rotation: Quaternion.multiply(
    Quaternion.fromAxisAngle(
      { x: 0, y: 1, z: 0 },
      baseFacingDeg + motion.facingOffsetDeg,
    ),
    Quaternion.multiply(Quaternion.inverse(base.rotation), source.rotation),
  ),
  scale: { ...source.scale },
});

const lerp = (from: number, to: number, progress: number): number =>
  from * (1 - progress) + to * progress;

const easingProgress = (
  easing: IAutoMovieFormationMotion["easing"],
  progress: number,
): number => {
  switch (easing) {
    case "linear":
      return progress;
    case "easeIn":
      return progress * progress;
    case "easeOut":
      return 1 - (1 - progress) * (1 - progress);
    case "easeInOut":
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    case "step":
      return progress < 1 ? 0 : 1;
  }
};
