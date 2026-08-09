import {
  IAutoMovieCompiledFormationLod,
  IAutoMovieFormationBounds,
  IAutoMovieFormationDesign,
  IAutoMovieFormationMotion,
  IAutoMovieFormationMotionState,
  IAutoMovieFormationSlot,
  IAutoMovieTransform,
  IAutoMovieVector3,
  IAutoMovieWorldSurface,
} from "@automovie/interface";

import { Quaternion } from "./math/Quaternion";
import { Vector3 } from "./math/Vector3";
import { seededValue } from "./math/random";
import { worldGroundHeight } from "./worldKit";

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
 * Regenerate one exact source-designed formation slot in constant memory.
 *
 * The compiler and ordinary measurement scripts share this pure derivation so a
 * slot queried from loaded project state is exactly the slot materialized into
 * the compiled formation. No filesystem or project state is consulted.
 */
export const formationSlot = (
  formation: IAutoMovieFormationDesign & IAutoMovieFormationGrounding,
  slot: number,
): IAutoMovieFormationSlot => {
  const actor =
    formation.heroOverrides.find((hero) => hero.slot === slot)?.actor ?? null;
  return {
    slot,
    node:
      actor ??
      `formation:${formation.id}:slot:${String(slot).padStart(6, "0")}`,
    actor,
    modelRecipe: formation.modelRecipe,
    position: formationSlotPosition(formation, slot),
    facingDeg: formation.facingDeg,
    motionPhase: seededValue(formation.seed, slot, 0x70686173),
  };
};

/**
 * The terrain a formation's members are placed on.
 *
 * Carried on the record rather than passed beside it, because a member's height
 * is part of where that member stands: a consumer that could ask for a position
 * without the ground would be a consumer that places a crowd flat, which is the
 * defect this exists to remove. The compiled formation snapshots exactly these
 * surfaces, so the compiler, the gate, the viewer and an offline measurement
 * script all place from one record and cannot answer differently.
 */
export interface IAutoMovieFormationGrounding {
  /**
   * World terrain under this formation, or absent when it stands on none.
   *
   * A snapshot of the production world's surfaces, kept beside the formation
   * the way a compiled instance set keeps the route it follows. Absent or empty
   * means no terrain was declared under the unit, and every member then stands
   * at the anchor's own height, which is what a formation did before ground was
   * sampled at all.
   */
  readonly ground?: readonly IAutoMovieWorldSurface[];
}

/** What a formation needs to say where one of its slots stands. */
export type IAutoMovieFormationPlacement = Pick<
  IAutoMovieFormationDesign,
  "id" | "count" | "layout" | "anchor" | "facingDeg" | "seed"
> &
  IAutoMovieFormationGrounding;

/**
 * Where one slot of a formation stands at rest, in world space.
 *
 * The position half of {@link formationSlot}, taken on its own because a
 * consumer that only asks where a member is should not have to hold the hero
 * overrides and model recipe that name it. The compiled formation carries
 * exactly this much, so the compiler can ask about a member without reaching
 * back for the design record beside it.
 *
 * A second implementation of this arithmetic is how a gate and a renderer come
 * to disagree about where a unit is standing, so there is one.
 *
 * Height comes from {@link formationGroundRelief}: the ground under the member,
 * not the ground under the group. A crowd on a rise stands on the rise.
 */
export const formationSlotPosition = (
  formation: IAutoMovieFormationPlacement,
  slot: number,
): IAutoMovieVector3 => {
  if (
    Number.isSafeInteger(slot) === false ||
    slot < 0 ||
    slot >= formation.count
  )
    throw new RangeError(
      `Formation "${formation.id}" slot ${slot} is outside 0..${formation.count - 1}.`,
    );
  const point = localFormationPoint(formation, slot);
  const radians = (formation.facingDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const x = formation.anchor.x + point.x * cosine + point.z * sine;
  const z = formation.anchor.z - point.x * sine + point.z * cosine;
  return {
    x,
    y: formation.anchor.y + formationGroundRelief(formation, { x, z }),
    z,
  };
};

/**
 * How far the terrain under one point rises above the terrain under the anchor.
 *
 * Relief rather than absolute ground, so `anchor.y` keeps meaning what it
 * always meant: the height the unit was staged at. A unit standing on its
 * ground has an anchor on that ground, and every member then lands on the
 * ground under itself; a unit deliberately staged a metre above its terrain
 * keeps that metre all the way up the hill instead of being snapped down at
 * placement time. It also makes level terrain exactly the old answer, so a
 * production on a flat floor compiles to the frames it compiled to before.
 *
 * Zero when the formation declares no terrain, when the point is over none, and
 * when the anchor itself is over none: relief is measured from the anchor's own
 * ground, and without that datum there is no rise to state. Those are the three
 * ways a unit keeps the single height it used to have, and each is a fact about
 * what was authored rather than a fallback that guesses.
 */
export const formationGroundRelief = (
  formation: IAutoMovieFormationGrounding & {
    anchor: IAutoMovieVector3;
  },
  point: { x: number; z: number },
): number => {
  const surfaces = formation.ground;
  if (surfaces === undefined || surfaces.length === 0) return 0;
  const here = worldGroundHeight(surfaces, point);
  if (here === null) return 0;
  const datum = formationGroundDatum(formation, surfaces);
  return datum === null ? 0 : here - datum;
};

/**
 * The anchor's own ground height, found once per formation record.
 *
 * Every member measures its relief against this one number, and a formation of
 * a hundred thousand members would otherwise ask the same question of the same
 * polygons a hundred thousand times. Keyed by the record itself, exactly as the
 * compiler keys the members it judges a unit by, so nothing outlives the
 * placement that asked.
 */
const formationGroundDatum = (
  formation: IAutoMovieFormationGrounding & { anchor: IAutoMovieVector3 },
  surfaces: readonly IAutoMovieWorldSurface[],
): number | null => {
  const remembered = formationGroundDatumCache.get(formation);
  if (remembered !== undefined) return remembered.height;
  const height = worldGroundHeight(surfaces, formation.anchor);
  formationGroundDatumCache.set(formation, { height });
  return height;
};

// Boxed, so a formation whose anchor is over nothing is remembered as such
// rather than looked up again on every one of its members.
const formationGroundDatumCache = new WeakMap<
  object,
  { height: number | null }
>();

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
 * Where a formation's box sits once a cue has moved and rescaled it.
 *
 * The eight corners go through {@link transformFormationPoint} and are re-bound,
 * because a facing offset rotates the box and an axis-aligned answer has to be
 * measured after the rotation rather than around it.
 *
 * This lives beside the point transform it composes rather than beside either
 * caller. Two consumers ask where a unit is: the oracle reports it and the
 * compiler refuses a unit standing off the ground its shot staged, and a
 * private copy in one of them is how the two come to disagree.
 */
export const transformFormationBounds = (
  bounds: IAutoMovieFormationBounds,
  anchor: IAutoMovieVector3,
  motion: IAutoMovieFormationMotionState,
  baseFacingDeg = 0,
): IAutoMovieFormationBounds => {
  const corners = [bounds.min.x, bounds.max.x].flatMap((x) =>
    [bounds.min.y, bounds.max.y].flatMap((y) =>
      [bounds.min.z, bounds.max.z].map((z) =>
        transformFormationPoint({ x, y, z }, anchor, motion, baseFacingDeg),
      ),
    ),
  );
  return {
    min: {
      x: Math.min(...corners.map((point) => point.x)),
      y: Math.min(...corners.map((point) => point.y)),
      z: Math.min(...corners.map((point) => point.z)),
    },
    max: {
      x: Math.max(...corners.map((point) => point.x)),
      y: Math.max(...corners.map((point) => point.y)),
      z: Math.max(...corners.map((point) => point.z)),
    },
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

/**
 * Offset one slot by its dressing tolerance, deterministically.
 *
 * Formed layouts place members on exact geometry, which reads as one figure
 * repeated on a grid rather than as troops holding a line. `dressing` states
 * how far a member may stand off its slot, and the deviation is drawn from the
 * formation seed and the slot index, the same machinery `scatter` placement and
 * `motionPhase` already use. Nothing is stored per member: the same design
 * regenerates the same army on every machine and every run.
 *
 * A layout without `dressing`, or with both tolerances at zero, returns the
 * exact point, so an existing production compiles unchanged.
 */
const dressedFormationPoint = (
  formation: IAutoMovieFormationPlacement,
  slot: number,
  point: { x: number; z: number },
): { x: number; z: number } => {
  const dressing =
    "dressing" in formation.layout ? formation.layout.dressing : undefined;
  if (dressing === undefined) return point;
  const deviation = (salt: number, bound: number): number =>
    bound === 0 ? 0 : (seededValue(formation.seed, slot, salt) * 2 - 1) * bound;
  return {
    x: point.x + deviation(0x64726573, dressing.lateral),
    z: point.z + deviation(0x73646570, dressing.depth),
  };
};

const localFormationPoint = (
  formation: IAutoMovieFormationPlacement,
  slot: number,
): { x: number; z: number } => {
  const layout = formation.layout;
  if (layout.kind === "line" || layout.kind === "column") {
    const rank =
      layout.kind === "line"
        ? Math.floor(slot / layout.files)
        : slot % layout.ranks;
    const file =
      layout.kind === "line"
        ? slot % layout.files
        : Math.floor(slot / layout.ranks);
    return dressedFormationPoint(formation, slot, {
      x: (file - (layout.files - 1) / 2) * layout.spacing.lateral,
      z: rank * layout.spacing.depth,
    });
  }
  if (layout.kind === "wedge") {
    const row = Math.floor(Math.sqrt(slot));
    const column = slot - row * row - row;
    return dressedFormationPoint(formation, slot, {
      x: column * layout.spacing.lateral,
      z: row * layout.spacing.depth,
    });
  }
  if (layout.kind === "arc") {
    const ratio = formation.count === 1 ? 0.5 : slot / (formation.count - 1);
    const degrees = (ratio - 0.5) * layout.arcDegrees;
    const radians = (degrees * Math.PI) / 180;
    return dressedFormationPoint(formation, slot, {
      x: Math.sin(radians) * layout.radius,
      z: Math.cos(radians) * layout.radius,
    });
  }
  const radius =
    Math.sqrt(seededValue(formation.seed, layout.seed, slot, 0)) *
    layout.radius;
  const angle = seededValue(formation.seed, layout.seed, slot, 1) * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius,
  };
};

/** Interpolate one scalar the one way every automovie cue interpolates. */
export const lerp = (from: number, to: number, progress: number): number =>
  from * (1 - progress) + to * progress;

/**
 * Shape one cue's linear progress by its declared curve.
 *
 * Exported because the per-member channel beside the unit-level one authors the
 * same `easing` names and must bend them identically. Two spellings of one
 * curve is how a member and the unit it stands in come to disagree about where
 * they are halfway through the same second.
 */
export const easingProgress = (
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
      // `sampleFormationMotion` applies a cue's exact `to` state before
      // interpolation once time reaches `end`, so interpolation only observes
      // progress below one.
      return 0;
  }
};
