import {
  IAutoMovieHeightRule,
  IAutoMovieSpace,
  IAutoMovieSurface,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  IAutoMovieFootprint,
  footprintContains,
  surfaceFootprint,
} from "./footprint";

/** Below this XZ span a ramp axis is degenerate and the patch reads as flat. */
const MIN_RAMP_AXIS = 1e-9;

/**
 * Prepared footprint for one surface. Build once when checking many points
 * against the same static polygon.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `IAutoMoviePreparedSurface` represents prepared footprint for one surface. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `IAutoMoviePreparedSurface` structures prepared footprint for one surface for the system that resolves host-relative support geometry and whole-footprint zone membership.
 * @author Samchon
 */
export interface IAutoMoviePreparedSurface {
  /**
   * The source surface whose height/identity remains authoritative.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `surface` records `IAutoMoviePreparedSurface`'s source surface whose height/identity remains authoritative. This ensures marks and supports resolve against their declared host geometry.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `surface` supplies `IAutoMoviePreparedSurface`'s source surface whose height/identity remains authoritative when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly surface: IAutoMovieSurface;

  /**
   * The exact plan region of {@link IAutoMovieSurface.polygon} and its holes.
   *
   * This used to be the footprint's convex hull, which is why an L-shaped plate
   * had to be refused: a hull fills the notch, and a hull of a holed slab fills
   * the atrium. The region carried here is the rings themselves.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `footprint` records `IAutoMoviePreparedSurface`'s exact plan region of `IAutoMovieSurface.polygon` and its holes. This ensures marks and supports resolve against their declared host geometry.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `footprint` supplies `IAutoMoviePreparedSurface`'s exact plan region of `IAutoMovieSurface.polygon` and its holes when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly footprint: IAutoMovieFootprint;
}

/**
 * Prepared footprint index for all surfaces in a space.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `IAutoMoviePreparedSpace` represents prepared footprint index for all surfaces in a space. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `IAutoMoviePreparedSpace` structures prepared footprint index for all surfaces in a space for the system that resolves host-relative support geometry and whole-footprint zone membership.
 * @author Samchon
 */
export interface IAutoMoviePreparedSpace {
  /**
   * The source space this prepared index was built from.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `space` records `IAutoMoviePreparedSpace`'s source space this prepared index was built from. This ensures marks and supports resolve against their declared host geometry.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `space` supplies `IAutoMoviePreparedSpace`'s source space this prepared index was built from when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly space: IAutoMovieSpace;

  /**
   * Surface footprints with precomputed convex hulls.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `surfaces` records `IAutoMoviePreparedSpace`'s surface footprints with precomputed convex hulls. This ensures marks and supports resolve against their declared host geometry.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `surfaces` supplies `IAutoMoviePreparedSpace`'s surface footprints with precomputed convex hulls when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly surfaces: readonly IAutoMoviePreparedSurface[];
}

/**
 * Precompute one surface footprint hull for repeated point queries.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `prepareSurface` precomputes one surface footprint hull for repeated point queries. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `prepareSurface` performs surface preparation when the engine resolves host-relative support geometry and whole-footprint zone membership.
 * @author Samchon
 */
export const prepareSurface = (
  surface: IAutoMovieSurface,
): IAutoMoviePreparedSurface => ({
  surface,
  footprint: surfaceFootprint(surface),
});

/**
 * Precompute every surface footprint hull in a space.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `prepareSpace` precomputes every surface footprint hull in a space. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `prepareSpace` performs space preparation when the engine resolves host-relative support geometry and whole-footprint zone membership.
 * @author Samchon
 */
export const prepareSpace = (
  space: IAutoMovieSpace,
): IAutoMoviePreparedSpace => {
  const remembered = preparedSpaceCache.get(space);
  if (remembered !== undefined) return remembered;
  const prepared = {
    space,
    surfaces: space.surfaces.map(prepareSurface),
  } satisfies IAutoMoviePreparedSpace;
  preparedSpaceCache.set(space, prepared);
  return prepared;
};

/**
 * One preparation per space record, keyed by the record itself.
 *
 * {@link heightAt}, {@link surfaceAt} and {@link surfaceContains} each default
 * their `prepared` argument to `prepareSpace(space)`, which is the call an
 * author writes: `heightAt(space, x, z)` for each place a body might go.
 * Without a memo that spelling hulls every footprint in the space again on
 * every point, so the natural loop over a crowd is quadratic in the scenery,
 * and the deterministic shot sandbox — which allows one second per module —
 * times out on a battlefield rather than on anything the author did wrong.
 *
 * Keyed by identity rather than by content, exactly as the formation ground
 * datum is: a caller holding one record asks about one geometry, and a caller
 * that built a new record has, as far as anything here can know, new geometry.
 * Weak, so a space stops being remembered when the shot that made it does.
 *
 * The consequence is that callers share one prepared value, which is read-only
 * by contract. Nothing in the engine writes to it, and a consumer that did
 * would already have been corrupting the value `spaceGround` closes over.
 */
const preparedSpaceCache = new WeakMap<
  IAutoMovieSpace,
  IAutoMoviePreparedSpace
>();

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
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `IAutoMovieHeightSurface` represents whatever states how high the ground is: either surface record answers here. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `IAutoMovieHeightSurface` structures whatever states how high the ground is: either surface record answers here for the system that resolves host-relative support geometry and whole-footprint zone membership.
 * @author Samchon
 */
export interface IAutoMovieHeightSurface {
  /**
   * The general ground rule, when the surface states one.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `height` records `IAutoMovieHeightSurface`'s general ground rule, when the surface states one. This ensures marks and supports resolve against their declared host geometry.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `height` supplies `IAutoMovieHeightSurface`'s general ground rule, when the surface states one when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly height?: IAutoMovieHeightRule | undefined;

  /**
   * First height anchor of the two-anchor spelling.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `anchor` records `IAutoMovieHeightSurface`'s first height anchor of the two-anchor spelling. This ensures marks and supports resolve against their declared host geometry.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `anchor` supplies `IAutoMovieHeightSurface`'s first height anchor of the two-anchor spelling when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly anchor?: IAutoMovieVector3 | undefined;

  /**
   * Second height anchor of the two-anchor spelling; `null` when flat.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `rampTo` records `IAutoMovieHeightSurface`'s second height anchor of the two-anchor spelling; `null` when flat. This ensures marks and supports resolve against their declared host geometry.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `rampTo` supplies `IAutoMovieHeightSurface`'s second height anchor of the two-anchor spelling; `null` when flat when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
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
 * patch stayed a plane — so there is one, and both records state their ground
 * in terms it reads.
 *
 * A stated {@link IAutoMovieHeightRule} is authoritative: `constant` is a level,
 * `plane` is `originHeight + slopeX·x + slopeZ·z`, and `heightfield` is
 * bilinear across the lattice cell the point falls in, clamped to the edge
 * samples outside it so a query off the lattice reads terrain that was authored
 * rather than extrapolated.
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
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `surfaceHeightAt` produces height of one surface at `(x, z)`, ignoring its footprint. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `surfaceHeightAt` performs height at surface evaluation when the engine resolves host-relative support geometry and whole-footprint zone membership.
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
 * Is `(x, z)` on the surface's footprint?
 *
 * Classified against the authored rings, not against their convex hull. That
 * distinction is the whole of #1868: a hull is always a superset, so an
 * L-shaped plate answered "yes" inside its own notch and a slab with an atrium
 * void answered "yes" over the void — silently, in the one query feet, props,
 * crowds and the camera base all read. `validateSpace` refused those footprints
 * precisely because this query could not tell the truth about them; it can now,
 * so they are authored instead of forbidden.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `surfaceContains` answers "Is `(x, z)` on the surface's footprint?" This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `surfaceContains` performs contains surface evaluation when the engine resolves host-relative support geometry and whole-footprint zone membership.
 */
export const surfaceContains = (
  surface: IAutoMovieSurface,
  x: number,
  z: number,
): boolean => preparedSurfaceContains(prepareSurface(surface), x, z);

/**
 * Is `(x, z)` on a prepared surface footprint?
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `preparedSurfaceContains` answers "Is `(x, z)` on a prepared surface footprint?" This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `preparedSurfaceContains` tests a prepared surface's cached footprint for the queried plan point.
 * @author Samchon
 */
export const preparedSurfaceContains = (
  prepared: IAutoMoviePreparedSurface,
  x: number,
  z: number,
): boolean => footprintContains(prepared.footprint, x, z);

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
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `surfaceAt` produces the **topmost** surface under `(x, z)` (walkable or not), or `null` when the point is over nothing. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `surfaceAt` performs at surface evaluation when the engine resolves host-relative support geometry and whole-footprint zone membership.
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
 * overhang clearance belongs to the structured building volume layer).
 *
 * `isWalkable` is exactly `heightAt !== null`, so the two queries can never
 * disagree.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `heightAt` produces the walking height at `(x, z)`: the height of the topmost surface there, **when that surface is walkable**: `null` over nothing and `null` when the topmost surface is a no-go top (standing space is occupied by something an actor may not stand on; this 2.5-D heightfield cannot walk _under_ it: overhang clearance belongs to the structured building volume layer). This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `heightAt` returns the topmost walkable height at a plan point and refuses empty or no-go tops with `null`.
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

/**
 * The walking height at every one of many plan points, in the order given.
 *
 * {@link heightAt} answers about one place, and the questions an author
 * actually has are about many at once: the ground along a route, under a
 * footprint, beneath each member of a crowd. Asked one call at a time from a
 * deterministic shot module, that is not merely N times the work. Every engine
 * call from the compile sandbox carries its arguments across a JSON boundary,
 * so a per-point call serializes the whole space per point and the host parses
 * a new record each time — which also defeats {@link prepareSpace}'s memo,
 * because the record it is handed is never the record it saw before. The
 * #1825 campaign timed out four shots that way while sampling terrain for a
 * climb.
 *
 * One crossing, one preparation, N answers. That is the same shape the rest of
 * this product already prefers: a crowd is a count and a layout rather than N
 * records, and the ground it stands on should be one question rather than N.
 *
 * Each answer is `null` on exactly the terms {@link heightAt} states — over
 * nothing, and over a top an actor may not stand on — so a caller reads the
 * result positionally and never has to guess which point a missing entry was.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `heightsAt` produces the walking height at each of many plan points against one prepared space. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `heightsAt` evaluates a batch of plan points through one space preparation and keeps each point's walkable-height answer in its own position.
 */
export const heightsAt = (
  space: IAutoMovieSpace,
  points: readonly { x: number; z: number }[],
): (number | null)[] => {
  const prepared = prepareSpace(space);
  return points.map((point) => heightAt(space, point.x, point.z, prepared));
};

/**
 * May an actor stand at `(x, z)`? Exactly `heightAt(...) !== null`.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `isWalkable` answers "May an actor stand at `(x, z)`?" This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `isWalkable` classifies a plan point by whether its topmost support surface permits standing.
 */
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
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `supportContactsFor` produces support contacts for an object footprint resting on the space: each footprint point that lies over a surface (walkable or not: objects rest on no-go tops too) becomes a contact at that surface's height; points over nothing contribute none. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `supportContactsFor` lifts every footprint point over a support surface to that surface's height and omits points over empty space.
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
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-mark-surface `spaceGround` adapts a prepared space into the `(x, z) → y` ground callback consumed by path following, foot planting, and ground-contact validation. This ensures marks and supports resolve against their declared host geometry.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `spaceGround` exposes the space's walkable-height query as the host-relative ground function used by motion seams.
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
