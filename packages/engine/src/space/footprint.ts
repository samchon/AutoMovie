import {
  IAutoMoviePlanarPoint,
  IAutoMovieSurface,
  IAutoMovieVector3,
} from "@automovie/interface";

import { pointInPolygon } from "../architecture/planarGeometry";
import { autoMoviePlanarRegionFailure } from "../geometry/planarRegion";
import { closestPointOnSegmentXZ, convexHull2D } from "../math/hull";

/**
 * The exact plan region a support surface covers: one outer ring and the voids
 * cut in it.
 *
 * This is the answer to the one thing a convex hull cannot say. The ground
 * query used to classify a point against `convexHull2D(surface.polygon)`, so an
 * L-shaped plate had its notch filled and a slab with an atrium void had the
 * void filled — silently, because a hull is always a superset and never
 * complains. Everything here classifies against the authored rings themselves,
 * which is what makes a concave plate concave and a hole a hole.
 *
 * The frame is the world XZ plan, `y` ignored, the same convention
 * {@link convexHull2D} and the balance/support queries already work in. Its twin
 * for a boundary's own local XY metres is `architecture/planarGeometry`, whose
 * crossing test is reused here rather than written a second time.
 *
 * **This is not `triangulateAutoMovieRegion` under another name, and merging
 * the two would break both.** That one is a mesh constructor: it is handed an
 * authored profile and it throws a diagnostic at every defect, which it can
 * afford to do because a build is where an author finds out. This one is a
 * query: it is handed whatever a record happens to say, including what
 * `validateSpace` refuses, and a foot asking where the ground is has to be
 * answered rather than thrown under. It also leaves a convex footprint as its
 * own hull, so every patch authored before holes existed tessellates to the
 * same bytes it always did.
 *
 * @author Samchon
 */

/**
 * Slack, in metres, within which a plan point counts as standing on a ring.
 *
 * A nanometre is exact for authored coordinates while keeping the classifier
 * from flickering across a rim as the last bits of a coordinate move.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `FOOTPRINT_EPSILON` fixes slack, in metres, within which a plan point counts as standing on a ring. This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `FOOTPRINT_EPSILON` bounds the footprint epsilon policy while the engine resolves host-relative support geometry and whole-footprint zone membership.
 */
export const FOOTPRINT_EPSILON = 1e-9;

/**
 * Where a plan point stands relative to one closed ring.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `AutoMovieRingPlacement` defines where a plan point stands relative to one closed ring. This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `AutoMovieRingPlacement` structures where a plan point stands relative to one closed ring for the system that resolves host-relative support geometry and whole-footprint zone membership.
 */
export type AutoMovieRingPlacement = "outside" | "boundary" | "inside";

/**
 * One closed ring of a footprint, with the plan projection and the signed area
 * the queries read.
 *
 * The planar copy is kept rather than derived per call: `spaceGround` is asked
 * per foot per frame, and mapping `(x, z)` to `(x, y)` inside that loop would
 * build one array per containment test.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `IAutoMovieFootprintRing` represents one closed ring of a footprint, with the plan projection and the signed area the queries read. This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `IAutoMovieFootprintRing` structures one closed ring of a footprint, with the plan projection and the signed area the queries read for the system that resolves host-relative support geometry and whole-footprint zone membership.
 * @author Samchon
 */
export interface IAutoMovieFootprintRing {
  /**
   * The ring as authored, in world XZ.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `points` records `IAutoMovieFootprintRing`'s ring as authored, in world XZ. This ensures membership is judged from a subject footprint rather than a point.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `points` supplies `IAutoMovieFootprintRing`'s ring as authored, in world XZ when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly points: readonly IAutoMovieVector3[];

  /**
   * The same ring as `(x, y) = (x, z)`, for the planar predicates.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `plan` records `IAutoMovieFootprintRing`'s same ring as `(x, y) = (x, z)`, for the planar predicates. This ensures membership is judged from a subject footprint rather than a point.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `plan` supplies `IAutoMovieFootprintRing`'s same ring as `(x, y) = (x, z)`, for the planar predicates when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly plan: readonly IAutoMoviePlanarPoint[];

  /**
   * Twice the signed plan area, positive in {@link convexHull2D}'s own winding.
   * Zero means the ring encloses nothing at all.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `doubleArea` records `IAutoMovieFootprintRing`'s twice the signed plan area, positive in `convexHull2D`'s own winding. This ensures membership is judged from a subject footprint rather than a point.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `doubleArea` supplies `IAutoMovieFootprintRing`'s twice the signed plan area, positive in `convexHull2D`'s own winding when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly doubleArea: number;
}

/**
 * A surface's plan region: the outer ring, and the holes cut out of it.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `IAutoMovieFootprint` represents a surface's plan region: the outer ring, and the holes cut out of it. This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `IAutoMovieFootprint` structures a surface's plan region: the outer ring, and the holes cut out of it for the system that resolves host-relative support geometry and whole-footprint zone membership.
 * @author Samchon
 */
export interface IAutoMovieFootprint {
  /**
   * The ring that bounds the region.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `outer` records `IAutoMovieFootprint`'s ring that bounds the region. This ensures membership is judged from a subject footprint rather than a point.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `outer` supplies `IAutoMovieFootprint`'s ring that bounds the region when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly outer: IAutoMovieFootprintRing;

  /**
   * Voids cut in {@link outer}; empty for a solid patch.
   *
   * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `holes` records `IAutoMovieFootprint`'s voids cut in `outer`; empty for a solid patch. This ensures membership is judged from a subject footprint rather than a point.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `holes` supplies `IAutoMovieFootprint`'s voids cut in `outer`; empty for a solid patch when the engine resolves host-relative support geometry and whole-footprint zone membership.
   */
  readonly holes: readonly IAutoMovieFootprintRing[];
}

/**
 * Prepare one closed ring for repeated plan queries.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `footprintRing` prepares one closed ring for repeated plan queries. This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `footprintRing` performs ring footprint evaluation when the engine resolves host-relative support geometry and whole-footprint zone membership.
 */
export const footprintRing = (
  points: readonly IAutoMovieVector3[],
): IAutoMovieFootprintRing => {
  const plan = points.map((point) => ({ x: point.x, y: point.z }));
  let doubleArea = 0;
  for (let index = 0; index < plan.length; ++index) {
    const current = plan[index]!;
    const next = plan[(index + 1) % plan.length]!;
    doubleArea += current.x * next.y - next.x * current.y;
  }
  return { points, plan, doubleArea };
};

/**
 * The plan region one support surface covers.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `surfaceFootprint` produces the plan region one support surface covers. This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `surfaceFootprint` performs footprint surface evaluation when the engine resolves host-relative support geometry and whole-footprint zone membership.
 */
export const surfaceFootprint = (
  surface: IAutoMovieSurface,
): IAutoMovieFootprint => ({
  outer: footprintRing(surface.polygon),
  holes: (surface.holes ?? []).map(footprintRing),
});

/**
 * Where `(x, z)` stands relative to one ring.
 *
 * The rim is answered before the crossing test, so a point sitting exactly on
 * an edge is `"boundary"` rather than whichever side the parity happened to
 * land on. A ring of fewer than three points bounds nothing, so every point is
 * outside it.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `footprintRingPlacement` returns where `(x, z)` stands relative to one ring. This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `footprintRingPlacement` performs ring placement footprint evaluation when the engine resolves host-relative support geometry and whole-footprint zone membership.
 */
export const footprintRingPlacement = (
  ring: IAutoMovieFootprintRing,
  x: number,
  z: number,
): AutoMovieRingPlacement => {
  if (ring.points.length < 3) return "outside";
  const probe = { x, y: 0, z };
  for (let index = 0; index < ring.points.length; ++index) {
    const near = closestPointOnSegmentXZ(
      probe,
      ring.points[index]!,
      ring.points[(index + 1) % ring.points.length]!,
    );
    if (Math.hypot(x - near.x, z - near.z) <= FOOTPRINT_EPSILON)
      return "boundary";
  }
  return pointInPolygon({ x, y: z }, ring.plan) ? "inside" : "outside";
};

/**
 * Is `(x, z)` on the surface the footprint describes?
 *
 * The region is closed: the outer rim and every hole rim belong to it, because
 * the slab physically reaches its own edge and a foot on the lip of an atrium
 * is standing on concrete. Only the open interior of a hole is off the
 * surface.
 *
 * A ring enclosing no area (fewer than three points, or all of them collinear)
 * covers nothing, matching what the hull query answered before holes existed;
 * `validateSpace` refuses such a footprint, so this is what a hand-built patch
 * reaching a renderer reads as rather than a throw.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `footprintContains` answers "Is `(x, z)` on the surface the footprint describes?" This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `footprintContains` performs contains footprint evaluation when the engine resolves host-relative support geometry and whole-footprint zone membership.
 */
export const footprintContains = (
  footprint: IAutoMovieFootprint,
  x: number,
  z: number,
): boolean => {
  if (footprint.outer.doubleArea === 0) return false;
  if (footprintRingPlacement(footprint.outer, x, z) === "outside") return false;
  return footprint.holes.every(
    (hole) => footprintRingPlacement(hole, x, z) !== "inside",
  );
};

/**
 * Plan area of the region, in square metres: the outer ring less its holes.
 *
 * Validation holds every hole strictly inside the outer ring and apart from
 * every other hole, so the subtraction cannot double-count and the result
 * cannot go negative for a record that passed. An unvalidated one is reported
 * as the arithmetic actually says rather than clamped, because a negative area
 * is a reader-visible symptom and a zero is a lie.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `footprintArea` produces plan area of the region, in square metres: the outer ring less its holes. This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `footprintArea` performs area calculation when the engine resolves host-relative support geometry and whole-footprint zone membership.
 */
export const footprintArea = (footprint: IAutoMovieFootprint): number =>
  footprint.holes.reduce(
    (area, hole) => area - Math.abs(hole.doubleArea) / 2,
    Math.abs(footprint.outer.doubleArea) / 2,
  );

/**
 * The footprint as convex pieces whose union is exactly the region.
 *
 * Everything that has to sweep, clip or draw a footprint wants convex input:
 * lattice clipping is Sutherland–Hodgman, a fan is only a triangulation of a
 * convex ring, and a containment probe against a convex piece is four
 * comparisons. Handing those a hull was the original defect; handing them a
 * decomposition of the true region is the same code with the notch and the hole
 * still missing from it.
 *
 * A solid convex footprint is already one convex piece and comes back as its
 * own hull, which is both the minimal decomposition and byte-for-byte what this
 * region used to produce. Anything else is decomposed by a vertical slab sweep:
 * cut the plan at every vertex `x`, and inside each slab pair the ring
 * crossings by even-odd parity, so a hole is a pair of crossings that closes
 * the band rather than a case anybody has to name. A degenerate region yields
 * nothing.
 *
 * **A ring that crosses itself has no region, and this does not invent one.**
 * Both readings of such a footprint stay finite and deterministic — nothing
 * throws, nothing is `NaN` — but the pieces here and what
 * {@link footprintContains} answers need not describe the same shape, because
 * there is no shape for them to agree on. That is why `validateSpace` refuses a
 * self-crossing ring outright rather than leaving either reading to stand for
 * it.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `footprintConvexPieces` produces the footprint as convex pieces whose union is exactly the region. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `footprintConvexPieces` performs convex pieces footprint evaluation when the engine checks finite planar topology before consuming geometry.
 */
export const footprintConvexPieces = (
  footprint: IAutoMovieFootprint,
): IAutoMovieVector3[][] => {
  const failure = autoMoviePlanarRegionFailure({
    outer: footprint.outer.plan,
    holes: footprint.holes.map((hole) => hole.plan),
    label: "footprint",
  });
  if (failure !== null) return [];
  if (footprint.outer.doubleArea === 0) return [];
  if (footprint.holes.length === 0) {
    const hull = convexHull2D(footprint.outer.points);
    if (isConvexRing(footprint.outer, hull)) return [hull];
  }
  return slabPieces(footprint);
};

/**
 * A plan point guaranteed to be on the region, or `null` when it has none.
 *
 * The mean of a ring's own vertices is not on the region that ring bounds: an
 * L-shaped plate's mean falls in its notch and a holed slab's falls straight
 * down the atrium, so anything anchoring to "the middle of the patch" that way
 * anchors where the patch is not. The mean of a convex piece is always inside
 * that piece, and the widest piece is chosen so the anchor sits in the part of
 * the patch there is most of. A patch that was already convex is its own widest
 * piece, so the answer is unchanged wherever it was already right.
 *
 * @evidence requirements/staging/marks-zones-and-blocking.md#staging-zone-membership `footprintInteriorPoint` produces a plan point guaranteed to be on the region, or `null` when it has none. This ensures membership is judged from a subject footprint rather than a point.
 * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership `footprintInteriorPoint` performs interior point footprint evaluation when the engine resolves host-relative support geometry and whole-footprint zone membership.
 */
export const footprintInteriorPoint = (
  footprint: IAutoMovieFootprint,
): { x: number; z: number } | null => {
  let best: IAutoMovieVector3[] | null = null;
  let bestArea = 0;
  for (const piece of footprintConvexPieces(footprint)) {
    const area = Math.abs(footprintRing(piece).doubleArea);
    if (area > bestArea) {
      best = piece;
      bestArea = area;
    }
  }
  if (best === null) return null;
  const sum = best.reduce(
    (total, point) => ({ x: total.x + point.x, z: total.z + point.z }),
    { x: 0, z: 0 },
  );
  return { x: sum.x / best.length, z: sum.z / best.length };
};

/**
 * Is the outer ring already convex, i.e. does every vertex sit on its own hull?
 *
 * This is the predicate `validateSpace` enforced while footprints had to be
 * convex, kept because it is still the question that decides whether a region
 * needs decomposing at all. For a simple ring it is exactly right: all vertices
 * on the hull and no crossing means the ring **is** the hull.
 *
 * A hull too small to enclose area holds no vertex on its boundary, so a
 * degenerate ring answers `false` without a case of its own.
 */
const isConvexRing = (
  ring: IAutoMovieFootprintRing,
  hull: readonly IAutoMovieVector3[],
): boolean => {
  const onHull = footprintRing(hull);
  return ring.points.every(
    (point) => footprintRingPlacement(onHull, point.x, point.z) === "boundary",
  );
};

/** One ring edge crossing a slab, kept with the edge that produced it. */
interface ISlabCrossing {
  /** Plan `z` where the edge crosses the slab's own mid-abscissa. */
  z: number;
  /** The crossing edge's start, in world XZ. */
  from: IAutoMovieVector3;
  /** The crossing edge's end, in world XZ. */
  to: IAutoMovieVector3;
}

/**
 * Decompose a region into trapezoids by sweeping vertical slabs.
 *
 * No vertex falls strictly inside a slab, so every edge that crosses the slab's
 * midline spans the whole slab, and the band between two consecutive crossings
 * is bounded left and right by those two edges alone. Sorting the crossings by
 * `z` and taking them in pairs is the even-odd rule, which is why a hole needs
 * no separate treatment: its two rims are simply the crossings that close one
 * band and open the next.
 */
const slabPieces = (footprint: IAutoMovieFootprint): IAutoMovieVector3[][] => {
  const rings = [footprint.outer, ...footprint.holes];
  const cuts = [
    ...new Set(rings.flatMap((ring) => ring.points.map((point) => point.x))),
  ].sort((left, right) => left - right);
  const pieces: IAutoMovieVector3[][] = [];
  for (let index = 0; index + 1 < cuts.length; ++index) {
    const left = cuts[index]!;
    const right = cuts[index + 1]!;
    if (right - left <= FOOTPRINT_EPSILON) continue;
    const middle = (left + right) / 2;
    const crossings: ISlabCrossing[] = [];
    for (const ring of rings)
      for (let edge = 0; edge < ring.points.length; ++edge) {
        const from = ring.points[edge]!;
        const to = ring.points[(edge + 1) % ring.points.length]!;
        if (Math.min(from.x, to.x) >= middle) continue;
        if (Math.max(from.x, to.x) <= middle) continue;
        crossings.push({ z: edgeZAt(from, to, middle), from, to });
      }
    crossings.sort((a, b) => a.z - b.z);
    for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
      const piece = slabPiece(
        crossings[pair]!,
        crossings[pair + 1]!,
        left,
        right,
      );
      if (piece.length >= 3) pieces.push(piece);
    }
  }
  return pieces;
};

/** Plan `z` of the edge `from → to` at abscissa `x`, which the edge spans. */
const edgeZAt = (
  from: IAutoMovieVector3,
  to: IAutoMovieVector3,
  x: number,
): number => from.z + ((x - from.x) / (to.x - from.x)) * (to.z - from.z);

/**
 * The trapezoid between two crossings over one slab, wound positively.
 *
 * Either vertical side collapses when the two edges meet at that abscissa (the
 * apex of a triangle), so the duplicated corner is dropped rather than emitted
 * as a zero-length edge no consumer could clip against. A band that collapses
 * at both ends encloses nothing and comes back as the two points it is, which
 * the sweep drops.
 */
const slabPiece = (
  lower: ISlabCrossing,
  upper: ISlabCrossing,
  left: number,
  right: number,
): IAutoMovieVector3[] => {
  const lowerLeft = { x: left, y: 0, z: edgeZAt(lower.from, lower.to, left) };
  const lowerRight = {
    x: right,
    y: 0,
    z: edgeZAt(lower.from, lower.to, right),
  };
  const upperRight = {
    x: right,
    y: 0,
    z: edgeZAt(upper.from, upper.to, right),
  };
  const upperLeft = { x: left, y: 0, z: edgeZAt(upper.from, upper.to, left) };
  const piece: IAutoMovieVector3[] = [lowerLeft, lowerRight];
  if (Math.abs(upperRight.z - lowerRight.z) > FOOTPRINT_EPSILON)
    piece.push(upperRight);
  if (Math.abs(upperLeft.z - lowerLeft.z) > FOOTPRINT_EPSILON)
    piece.push(upperLeft);
  return piece;
};
