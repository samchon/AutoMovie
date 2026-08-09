import {
  IAutoMovieHeightRule,
  IAutoMovieSpace,
  IAutoMovieSurface,
  IAutoMovieVector3,
} from "@automovie/interface";

import { convexHull2D, pointInHull } from "../math/hull";

/** Below this XZ span a ramp axis is degenerate and the patch reads as flat. */
const MIN_RAMP_AXIS = 1e-9;

/**
 * Prepared footprint for one surface. Build once when checking many points
 * against the same static polygon.
 *
 * @author Samchon
 */
export interface IAutoMoviePreparedSurface {
  /** The source surface whose height/identity remains authoritative. */
  readonly surface: IAutoMovieSurface;

  /** Convex hull of {@link IAutoMovieSurface.polygon}, in XZ plan. */
  readonly hull: readonly IAutoMovieVector3[];
}

/**
 * Prepared footprint index for all surfaces in a space.
 *
 * @author Samchon
 */
export interface IAutoMoviePreparedSpace {
  /** The source space this prepared index was built from. */
  readonly space: IAutoMovieSpace;

  /** Surface footprints with precomputed convex hulls. */
  readonly surfaces: readonly IAutoMoviePreparedSurface[];
}

/**
 * Precompute one surface footprint hull for repeated point queries.
 *
 * @author Samchon
 */
export const prepareSurface = (
  surface: IAutoMovieSurface,
): IAutoMoviePreparedSurface => ({
  surface,
  hull: convexHull2D(surface.polygon),
});

/**
 * Precompute every surface footprint hull in a space.
 *
 * @author Samchon
 */
export const prepareSpace = (space: IAutoMovieSpace): IAutoMoviePreparedSpace =>
  ({
    space,
    surfaces: space.surfaces.map(prepareSurface),
  }) satisfies IAutoMoviePreparedSpace;

/**
 * Whatever states how high the ground is: either surface record answers here.
 *
 * A scene's {@link IAutoMovieSurface} and a production world's
 * `IAutoMovieWorldSurface` are two records for one thing, the ground, and both
 * are read by {@link surfaceHeightAt}. Spelled structurally rather than as a
 * union of the two so nothing has to name the world's record to ask its height,
 * and so a caller holding neither — a prepared patch, a projected footprint —
 * can still ask.
 *
 * @author Samchon
 */
export interface IAutoMovieHeightSurface {
  /** The general ground rule, when the surface states one. */
  readonly height?: IAutoMovieHeightRule | undefined;

  /** First height anchor of the two-anchor spelling. */
  readonly anchor?: IAutoMovieVector3 | undefined;

  /** Second height anchor of the two-anchor spelling; `null` when flat. */
  readonly rampTo?: IAutoMovieVector3 | null | undefined;
}

/**
 * Height of one surface at `(x, z)`, ignoring its footprint.
 *
 * **The one height function.** A performer standing, a crowd member placed on
 * terrain, a foot planted through {@link spaceGround}, the gate that refuses a
 * unit standing under its ground, and the camera base solved from where they
 * all ended up: every one of them reaches this. A second implementation that
 * agrees today is exactly how a named performer and the crowd behind it came to
 * stand on two different grounds — the world's terrain rose and the scene's
 * patch stayed a plane — so there is one, and both records state their ground in
 * terms it reads.
 *
 * A stated {@link IAutoMovieHeightRule} is authoritative: `constant` is a level,
 * `plane` is `originHeight + slopeX·x + slopeZ·z`, and `heightfield` is bilinear
 * across the lattice cell the point falls in, clamped to the edge samples
 * outside it so a query off the lattice reads terrain that was authored rather
 * than extrapolated.
 *
 * Without one, the two-anchor spelling answers, unchanged: a flat patch is
 * `anchor.y` everywhere; a sloped patch interpolates linearly along the `anchor
 * → rampTo` axis on the ground plan (constant perpendicular, a plane). Points
 * beyond the anchors extrapolate on that plane; the polygon, not the anchors,
 * bounds where the surface exists (see {@link surfaceContains}). A degenerate
 * ramp axis (same XZ as the anchor, rejected by {@link validateSpace}) safely
 * reads as flat.
 *
 * A surface stating neither reads as the scalar zero plane the engine assumed
 * before spaces existed. `validateSpace` refuses one, so this is what a
 * hand-built patch reaching a renderer answers rather than a throw.
 *
 * @author Samchon
 */
export const surfaceHeightAt = (
  surface: IAutoMovieHeightSurface,
  x: number,
  z: number,
): number => {
  const rule = surface.height;
  if (rule === undefined) return anchoredHeightAt(surface, x, z);
  if (rule.kind === "constant") return rule.value;
  if (rule.kind === "plane")
    return rule.originHeight + rule.slopeX * x + rule.slopeZ * z;
  // Bilinear over the cell the point falls in. The lattice coordinate is
  // clamped before the cell is chosen, so a query outside the grid reads its
  // nearest edge instead of extrapolating relief nobody authored.
  const column = latticeCell((x - rule.originX) / rule.spacingX, rule.columns);
  const row = latticeCell((z - rule.originZ) / rule.spacingZ, rule.rows);
  const near = mix(
    heightfieldSample(rule, column.index, row.index),
    heightfieldSample(rule, column.index + 1, row.index),
    column.fraction,
  );
  const far = mix(
    heightfieldSample(rule, column.index, row.index + 1),
    heightfieldSample(rule, column.index + 1, row.index + 1),
    column.fraction,
  );
  return mix(near, far, row.fraction);
};

/** The two-anchor spelling of a level or single-plane patch. */
const anchoredHeightAt = (
  surface: IAutoMovieHeightSurface,
  x: number,
  z: number,
): number => {
  const anchor = surface.anchor;
  if (anchor === undefined) return 0;
  const rampTo = surface.rampTo ?? null;
  if (rampTo === null) return anchor.y;
  const ax = rampTo.x - anchor.x;
  const az = rampTo.z - anchor.z;
  const span = ax * ax + az * az;
  if (span < MIN_RAMP_AXIS) return anchor.y;
  const t = ((x - anchor.x) * ax + (z - anchor.z) * az) / span;
  return anchor.y + t * (rampTo.y - anchor.y);
};

/**
 * Which cell of a lattice a coordinate falls in, and how far across it.
 *
 * The coordinate is clamped into the lattice first, so a point outside reads
 * the edge cell at fraction zero or one rather than an extrapolated one. A
 * lattice of a single line has no cell to cross and reads that line.
 */
const latticeCell = (
  coordinate: number,
  count: number,
): { index: number; fraction: number } => {
  const last = Math.max(0, count - 2);
  const clamped = Math.min(Math.max(coordinate, 0), Math.max(0, count - 1));
  const index = Math.min(Math.floor(clamped), last);
  return { index, fraction: clamped - index };
};

/**
 * One stored sample, with its indices clamped into the declared grid.
 *
 * A record whose `samples` is shorter than `columns * rows` is refused by
 * validation; reading it here answers zero rather than `NaN`, so a placement
 * built on a malformed field is wrong in a way a reader can see instead of
 * poisoning every arithmetic downstream of it.
 */
const heightfieldSample = (
  rule: Extract<IAutoMovieHeightRule, { kind: "heightfield" }>,
  column: number,
  row: number,
): number =>
  rule.samples[
    Math.min(Math.max(row, 0), rule.rows - 1) * rule.columns +
      Math.min(Math.max(column, 0), rule.columns - 1)
  ] ?? 0;

const mix = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;

/**
 * Is `(x, z)` on the surface's footprint? The polygon is canonicalized through
 * the shared convex hull, so a mis-ordered or accidentally non-convex point
 * list still classifies correctly (the same guarantee `validateBalanceSupport`
 * gained in #601).
 */
export const surfaceContains = (
  surface: IAutoMovieSurface,
  x: number,
  z: number,
): boolean => preparedSurfaceContains(prepareSurface(surface), x, z);

/**
 * Is `(x, z)` on a prepared surface footprint?
 *
 * @author Samchon
 */
export const preparedSurfaceContains = (
  prepared: IAutoMoviePreparedSurface,
  x: number,
  z: number,
): boolean => pointInHull({ x, y: 0, z }, prepared.hull);

/**
 * The **topmost** surface under `(x, z)` (walkable or not), or `null` when the
 * point is over nothing. Topmost is decided by the surface height _at that
 * point_ (a ramp may pass over a floor); an exact tie keeps the earlier surface
 * in the array, so the query is deterministic.
 *
 * This is the "what is here" query: an object rests on the topmost surface
 * regardless of walkability. For "may an actor stand here", see {@link heightAt}
 * / {@link isWalkable}.
 *
 * @author Samchon
 */
export const surfaceAt = (
  space: IAutoMovieSpace,
  x: number,
  z: number,
  prepared: IAutoMoviePreparedSpace = prepareSpace(space),
): IAutoMovieSurface | null => {
  let best: IAutoMovieSurface | null = null;
  let bestHeight = -Infinity;
  for (const entry of prepared.surfaces) {
    if (!preparedSurfaceContains(entry, x, z)) continue;
    const surface = entry.surface;
    const height = surfaceHeightAt(surface, x, z);
    if (height > bestHeight) {
      best = surface;
      bestHeight = height;
    }
  }
  return best;
};

/**
 * The walking height at `(x, z)`: the height of the topmost surface there,
 * **when that surface is walkable**: `null` over nothing and `null` when the
 * topmost surface is a no-go top (standing space is occupied by something an
 * actor may not stand on; this 2.5-D heightfield cannot walk _under_ it:
 * overhangs are interia's future refinement).
 *
 * `isWalkable` is exactly `heightAt !== null`, so the two queries can never
 * disagree.
 *
 * @author Samchon
 */
export const heightAt = (
  space: IAutoMovieSpace,
  x: number,
  z: number,
  prepared: IAutoMoviePreparedSpace = prepareSpace(space),
): number | null => {
  const surface = surfaceAt(space, x, z, prepared);
  if (surface === null) return null;
  if (!space.walkable.includes(surface.id)) return null;
  return surfaceHeightAt(surface, x, z);
};

/** May an actor stand at `(x, z)`? Exactly `heightAt(...) !== null`. */
export const isWalkable = (
  space: IAutoMovieSpace,
  x: number,
  z: number,
  prepared: IAutoMoviePreparedSpace = prepareSpace(space),
): boolean => heightAt(space, x, z, prepared) !== null;

/**
 * Support contacts for an object footprint resting on the space: each footprint
 * point that lies over a surface (walkable or not: objects rest on no-go tops
 * too) becomes a contact at that surface's height; points over nothing
 * contribute none. The result feeds {@link detectSupportToppling} directly: a
 * crate half off a table edge yields only the on-table contacts, so its
 * overhanging center of mass topples exactly as #601 judges it.
 *
 * @author Samchon
 */
export const supportContactsFor = (
  space: IAutoMovieSpace,
  footprint: readonly IAutoMovieVector3[],
): IAutoMovieVector3[] => {
  const contacts: IAutoMovieVector3[] = [];
  const prepared = prepareSpace(space);
  for (const point of footprint) {
    const surface = surfaceAt(space, point.x, point.z, prepared);
    if (surface === null) continue;
    contacts.push({
      x: point.x,
      y: surfaceHeightAt(surface, point.x, point.z),
      z: point.z,
    });
  }
  return contacts;
};

/**
 * Adapt a space into the `(x, z) → y` ground callback the motion seams consume
 * ({@link followPathMotion}'s ground, {@link plantStanceFeet} /
 * {@link validateGroundContact}'s widened `groundY`). Over nothing or over a
 * no-go top it returns `fallback` (default `0`, the scalar plane the engine
 * assumed before the space layer, so an authored path that strays off the
 * surfaces degrades to the legacy behavior instead of a solver-ish
 * nearest-surface search, which stays deferred).
 *
 * @author Samchon
 */
export const spaceGround = (
  space: IAutoMovieSpace,
  fallback = 0,
): ((x: number, z: number) => number) => {
  const prepared = prepareSpace(space);
  return (x: number, z: number): number =>
    heightAt(space, x, z, prepared) ?? fallback;
};
