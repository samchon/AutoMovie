import {
  IAutoMovieBoundaryFace,
  IAutoMovieOpeningProfile,
  IAutoMoviePlanarPoint,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  outlineHull,
  polygonBounds,
  polygonDoubleArea,
} from "../architecture/planarGeometry";
import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import {
  IAutoMovieDrawingTriangle,
  roundAutoMovieDrawingScalar,
} from "./drawingProjection";

/**
 * Radians of arc each drafted chord spans.
 *
 * Vector drafting has no curves, only chords, so the only honest choice is a
 * fixed one: a constant density means the same arc yields the same chords on
 * every machine and every run, and a drawing's digest stays a property of the
 * design rather than of how large the arc happened to be.
 */
export const AUTOMOVIE_DRAWING_ARC_STEP = Math.PI / 16;

/** Below this the bulge is a straight edge, not an arc anybody can see. */
const BULGE_EPSILON = 1e-12;

/**
 * Flatten a profile outline into the points a drawing drafts it through.
 *
 * Straight edges contribute their own endpoint; a bulged edge contributes its
 * endpoint and then the chord points along its arc, so the returned ring is a
 * closed polyline ready to project. The density is fixed rather than adaptive
 * because an adaptive one would make a drawing's linework depend on the size of
 * the thing drawn, and two derivations of one revision could then differ.
 *
 * This is drafting, not measurement. Nothing that reports a dimension reads
 * these chords: {@link autoMovieOpeningExtent} answers from the engine's own
 * bounding hull instead, so the size a schedule prints is the size the wall
 * kernel cuts.
 *
 * @author Samchon
 */
export const autoMovieOpeningOutlinePoints = (
  profile: IAutoMovieOpeningProfile,
): IAutoMoviePlanarPoint[] => {
  const points: IAutoMoviePlanarPoint[] = [];
  for (let index = 0; index < profile.outline.length; ++index) {
    const from = profile.outline[index]!;
    const to = profile.outline[(index + 1) % profile.outline.length]!;
    points.push(from);
    const arc = arcOf(from, to, profile.bulges?.[index] ?? 0);
    if (arc === null) continue;
    const steps = Math.max(
      1,
      Math.ceil(Math.abs(arc.sweep) / AUTOMOVIE_DRAWING_ARC_STEP),
    );
    for (let step = 1; step < steps; ++step) {
      const angle = arc.start + (arc.sweep * step) / steps;
      points.push({
        x: arc.center.x + arc.radius * Math.cos(angle),
        y: arc.center.y + arc.radius * Math.sin(angle),
      });
    }
  }
  return points;
};

/**
 * The size of an opening's void, in its host boundary's own metres.
 *
 * Deliberately the engine's existing bounding hull of the outline rather than a
 * second arithmetic of its own. `builtBoundaryWallCut` hands that same hull to
 * the mesh kernel as the rectangle it actually cuts, and validation holds the
 * void inside its face by the same hull, so a schedule that measured the arc
 * more finely would print a width no hole in the building has.
 *
 * @author Samchon
 */
export const autoMovieOpeningExtent = (
  profile: IAutoMovieOpeningProfile,
): { width: number; height: number } => {
  const bounds = polygonBounds(outlineHull(profile));
  return {
    width: roundAutoMovieDrawingScalar(bounds.max.x - bounds.min.x),
    height: roundAutoMovieDrawingScalar(bounds.max.y - bounds.min.y),
  };
};

/**
 * The exact area of an opening's void, in square metres.
 *
 * Exact rather than the bounding hull's area, because an area is a quantity
 * somebody orders glass by while an extent is a rectangle somebody cuts a hole
 * for: the hull that governs the cut deliberately errs towards refusing, and
 * carrying that error into a take-off would over-order every arch in the
 * building. The straight polygon's own area is corrected by each arc's circular
 * segment, which is a closed form and not a sampling of the chords the drawing
 * happens to draft.
 *
 * @author Samchon
 */
export const autoMovieOpeningArea = (
  profile: IAutoMovieOpeningProfile,
): number => {
  let doubled = polygonDoubleArea(profile.outline);
  for (let index = 0; index < profile.outline.length; ++index) {
    const arc = arcOf(
      profile.outline[index]!,
      profile.outline[(index + 1) % profile.outline.length]!,
      profile.bulges?.[index] ?? 0,
    );
    if (arc === null) continue;
    doubled += arc.radius * arc.radius * (arc.sweep - Math.sin(arc.sweep));
  }
  return roundAutoMovieDrawingScalar(Math.abs(doubled) / 2);
};

/**
 * The nominal size a filling element stands in for, from its world extent.
 *
 * Openings in a building stand up: the world up axis is the height, and the
 * wider of the two horizontal extents is the width. A leaf lying on its side is
 * described by this as a wide, thin opening, which is exactly what its own
 * bounding extents say about it — and why a size taken this way is labelled as
 * the leaf's rather than the hole's everywhere it is reported.
 */
export const autoMovieOpeningFillExtent = (
  corners: readonly IAutoMovieVector3[],
): { width: number; height: number } => {
  const spanX = span(corners.map((corner) => corner.x));
  const spanY = span(corners.map((corner) => corner.y));
  const spanZ = span(corners.map((corner) => corner.z));
  return {
    width: roundAutoMovieDrawingScalar(Math.max(spanX, spanZ)),
    height: roundAutoMovieDrawingScalar(spanY),
  };
};

/** Whether any edge of a profile actually bulges. */
export const autoMovieOpeningHasArc = (
  profile: IAutoMovieOpeningProfile,
): boolean =>
  (profile.bulges ?? []).some((bulge) => Math.abs(bulge) > BULGE_EPSILON);

/**
 * Place one boundary-local point in world space.
 *
 * The face's frame is a full rigid placement, so a wall out of plumb or a
 * sloping soffit resolves exactly here rather than being flattened to a
 * heading. `depth` walks along the face's own outward normal, which is how the
 * near and far faces of a separation of stated thickness are reached.
 */
export const autoMovieBoundaryFacePoint = (
  face: IAutoMovieBoundaryFace,
  point: IAutoMoviePlanarPoint,
  depth = 0,
): IAutoMovieVector3 =>
  Vector3.add(
    face.origin,
    Quaternion.rotateVector(face.rotation, {
      x: point.x,
      y: point.y,
      z: depth,
    }),
  );

/**
 * The closed solid one boundary's declared face stands for.
 *
 * A separation is a slab, not a sheet: the face outline swept along its own
 * outward normal by its stated thickness. The solid is closed on purpose — both
 * caps are triangulated — because a plan cut through an open shell would draw
 * only the two ends of a wall and leave its faces off the sheet, and an
 * elevation of an open shell would draft both rings where one silhouette
 * belongs.
 *
 * The outline may be concave, so the caps are ear-clipped rather than fanned: a
 * fan from one corner of an L-shaped soffit puts triangles outside the soffit,
 * and a cut through those would draw walls nobody built.
 *
 * @author Samchon
 */
export const autoMovieBoundaryShellTriangles = (
  face: IAutoMovieBoundaryFace,
): IAutoMovieDrawingTriangle[] => {
  // Counter-clockwise so the far cap, the near cap and the sides all end up
  // wound outward, which is what makes the silhouette test read facing rather
  // than authoring order.
  const outline =
    polygonDoubleArea(face.outline) < 0
      ? [...face.outline].reverse()
      : face.outline;
  const near = outline.map((point) =>
    autoMovieBoundaryFacePoint(face, point, 0),
  );
  const far = outline.map((point) =>
    autoMovieBoundaryFacePoint(face, point, face.thickness),
  );
  const triangles: IAutoMovieDrawingTriangle[] = [];
  for (let index = 0; index < outline.length; ++index) {
    const next = (index + 1) % outline.length;
    triangles.push(
      { a: near[index]!, b: near[next]!, c: far[next]! },
      { a: near[index]!, b: far[next]!, c: far[index]! },
    );
  }
  for (const [first, second, third] of triangulateAutoMoviePolygon(outline)) {
    triangles.push({ a: far[first]!, b: far[second]!, c: far[third]! });
    triangles.push({ a: near[third]!, b: near[second]!, c: near[first]! });
  }
  return triangles;
};

/**
 * Ear-clip one simple planar polygon into triangle index triples.
 *
 * Each pass scores every remaining corner and clips the best one: a reflex
 * corner scores below a convex corner that still covers another vertex, which
 * scores below a true ear, and among ears the fattest wins. Scoring rather than
 * searching is what removes the "no ear was found" case entirely — one corner
 * is always the best one — so the loop always makes progress and there is no
 * unreachable branch pretending to handle an impossible polygon.
 *
 * @author Samchon
 */
export const triangulateAutoMoviePolygon = (
  polygon: readonly IAutoMoviePlanarPoint[],
): Array<[number, number, number]> => {
  const ring = polygon.map((_, index) => index);
  const triangles: Array<[number, number, number]> = [];
  while (ring.length > 3) {
    const pick = ring.reduce(
      (best, _, index) =>
        earScore(polygon, ring, index) > earScore(polygon, ring, best)
          ? index
          : best,
      0,
    );
    triangles.push([
      ring[(pick + ring.length - 1) % ring.length]!,
      ring[pick]!,
      ring[(pick + 1) % ring.length]!,
    ]);
    ring.splice(pick, 1);
  }
  triangles.push([ring[0]!, ring[1]!, ring[2]!]);
  return triangles;
};

const earScore = (
  polygon: readonly IAutoMoviePlanarPoint[],
  ring: readonly number[],
  index: number,
): number => {
  const previous = polygon[ring[(index + ring.length - 1) % ring.length]!]!;
  const corner = polygon[ring[index]!]!;
  const next = polygon[ring[(index + 1) % ring.length]!]!;
  const turn =
    (corner.x - previous.x) * (next.y - previous.y) -
    (corner.y - previous.y) * (next.x - previous.x);
  if (turn <= 0) return -1;
  for (let other = 0; other < ring.length; ++other) {
    if (
      other === index ||
      other === (index + ring.length - 1) % ring.length ||
      other === (index + 1) % ring.length
    )
      continue;
    if (inTriangle(polygon[ring[other]!]!, previous, corner, next)) return 0;
  }
  return turn;
};

const inTriangle = (
  point: IAutoMoviePlanarPoint,
  a: IAutoMoviePlanarPoint,
  b: IAutoMoviePlanarPoint,
  c: IAutoMoviePlanarPoint,
): boolean => {
  const side = (
    from: IAutoMoviePlanarPoint,
    to: IAutoMoviePlanarPoint,
  ): number =>
    (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
  return side(a, b) >= 0 && side(b, c) >= 0 && side(c, a) >= 0;
};

/** The circle one bulged edge runs on. */
interface IArc {
  center: IAutoMoviePlanarPoint;
  radius: number;
  start: number;
  sweep: number;
}

const arcOf = (
  from: IAutoMoviePlanarPoint,
  to: IAutoMoviePlanarPoint,
  bulge: number,
): IArc | null => {
  if (Math.abs(bulge) <= BULGE_EPSILON) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  if (chord <= BULGE_EPSILON) return null;
  // The bulge is `tan(|sweep| / 4)` and, in this design's convention, a positive
  // one bulges to the LEFT of the edge's own direction — the same convention
  // `outlineHull` places its sagitta by, because two spellings of which way an
  // arch curves is one spelling too many. The centre therefore sits on the
  // opposite side of the chord from the bulge, at the signed distance below,
  // which runs off to infinity exactly as the bulge goes to zero and the arc
  // becomes the chord; and the sweep runs clockwise for a positive bulge, which
  // is what puts the arc on the left.
  const offset = (chord * (1 - bulge * bulge)) / (4 * bulge);
  const center = {
    x: (from.x + to.x) / 2 + (offset * dy) / chord,
    y: (from.y + to.y) / 2 - (offset * dx) / chord,
  };
  return {
    center,
    radius: Math.hypot(chord / 2, offset),
    start: Math.atan2(from.y - center.y, from.x - center.x),
    sweep: -4 * Math.atan(bulge),
  };
};

const span = (values: readonly number[]): number =>
  Math.max(...values) - Math.min(...values);
