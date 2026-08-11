import {
  IAutoMovieOpeningProfile,
  IAutoMoviePlanarPoint,
} from "@automovie/interface";

/**
 * Planar polygon arithmetic for boundary faces and the voids cut in them.
 *
 * Everything here works in one boundary's own local XY metres, which is the
 * only frame in which "the door is inside the wall" is a question with an
 * answer. The predicates are deliberately split by strictness rather than
 * shared: a void may sit flush against the edge of its wall (a door reaching
 * the floor is not a defect), so containment tolerates touching, while two
 * voids that touch are one void authored twice, so separation does not.
 */

/**
 * Slack, in metres, below which two planar coordinates are the same point.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `PLANAR_EPSILON` fixes slack, in metres, below which two planar coordinates are the same point. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `PLANAR_EPSILON` bounds the planar epsilon policy while the engine checks finite planar topology before consuming geometry.
 */
export const PLANAR_EPSILON = 1e-9;

/**
 * The straight polygon that exactly bounds a possibly arced outline.
 *
 * A circular arc of at most a half turn never leaves the rectangle spanned by
 * its own chord and its sagitta: measured in the chord frame its tangential
 * extent is the chord itself and its normal extent is the sagitta, both reached
 * exactly. Replacing each arc edge by that rectangle's two far corners
 * therefore yields a straight polygon containing the true outline, tight at
 * every extreme, and every containment or separation answer taken from it errs
 * only towards refusing.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `outlineHull` produces the straight polygon that exactly bounds a possibly arced outline. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `outlineHull` replaces arced edges with sampled points and returns their bounding straight polygon for finite topology checks.
 */
export const outlineHull = (
  profile: IAutoMovieOpeningProfile,
): IAutoMoviePlanarPoint[] => {
  const points = profile.outline;
  const hull: IAutoMoviePlanarPoint[] = [];
  points.forEach((from, index) => {
    const to = points[(index + 1) % points.length]!;
    hull.push(from);
    const bulge = profile.bulges?.[index] ?? 0;
    if (bulge === 0) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const chord = Math.hypot(dx, dy);
    // The sagitta of a bulged edge is half its chord times the bulge, and the
    // arc leans to the left of the edge's own direction for a positive bulge.
    const sagitta = (chord / 2) * bulge;
    const offsetX = (-dy / chord) * sagitta;
    const offsetY = (dx / chord) * sagitta;
    hull.push({ x: from.x + offsetX, y: from.y + offsetY });
    hull.push({ x: to.x + offsetX, y: to.y + offsetY });
  });
  return hull;
};

/**
 * Twice the signed area of a closed polygon, positive when counter-clockwise.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `polygonDoubleArea` produces twice the signed area of a closed polygon, positive when counter-clockwise. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `polygonDoubleArea` performs area calculation when the engine checks finite planar topology before consuming geometry.
 */
export const polygonDoubleArea = (
  polygon: readonly IAutoMoviePlanarPoint[],
): number => {
  let sum = 0;
  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    sum += point.x * next.y - next.x * point.y;
  });
  return sum;
};

/**
 * The shortest edge length of a closed polygon.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `polygonShortestEdge` produces the shortest edge length of a closed polygon. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `polygonShortestEdge` performs shortest edge polygon calculation when the engine checks finite planar topology before consuming geometry.
 */
export const polygonShortestEdge = (
  polygon: readonly IAutoMoviePlanarPoint[],
): number =>
  Math.min(
    ...polygon.map((point, index) => {
      const next = polygon[(index + 1) % polygon.length]!;
      return Math.hypot(next.x - point.x, next.y - point.y);
    }),
  );

/**
 * Whether a closed polygon never crosses or touches itself away from a shared
 * corner.
 *
 * A self-crossing outline has no interior, so every later question about what
 * is inside it would answer arbitrarily. Adjacent edges are skipped because
 * they legitimately meet at the corner they share.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `polygonIsSimple` produces whether a closed polygon never crosses or touches itself away from a shared corner. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `polygonIsSimple` performs is simple polygon calculation when the engine checks finite planar topology before consuming geometry.
 */
export const polygonIsSimple = (
  polygon: readonly IAutoMoviePlanarPoint[],
): boolean => {
  const count = polygon.length;
  for (let left = 0; left < count; ++left)
    for (let right = left + 1; right < count; ++right) {
      const adjacent =
        right === left + 1 || (left === 0 && right === count - 1);
      if (adjacent) continue;
      if (
        segmentsTouch(
          polygon[left]!,
          polygon[(left + 1) % count]!,
          polygon[right]!,
          polygon[(right + 1) % count]!,
        )
      )
        return false;
    }
  return true;
};

/**
 * Whether a point is inside a simple polygon, its own boundary included.
 *
 * Exported because the service-network validator locates a port on a boundary
 * face with it: one planar containment answer for the whole architecture graph
 * is the point of keeping these predicates in one module.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `pointInPolygon` produces whether a point is inside a simple polygon, its own boundary included. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `pointInPolygon` classifies a finite point against a simple polygon while treating its boundary as inside.
 */
export const pointInPolygon = (
  point: IAutoMoviePlanarPoint,
  polygon: readonly IAutoMoviePlanarPoint[],
): boolean => {
  for (let index = 0; index < polygon.length; ++index)
    if (
      pointOnSegment(
        point,
        polygon[index]!,
        polygon[(index + 1) % polygon.length]!,
      )
    )
      return true;
  let inside = false;
  for (let index = 0; index < polygon.length; ++index) {
    const from = polygon[index]!;
    const to = polygon[(index + 1) % polygon.length]!;
    if (
      from.y > point.y !== to.y > point.y &&
      point.x <
        from.x + ((point.y - from.y) / (to.y - from.y)) * (to.x - from.x)
    )
      inside = !inside;
  }
  return inside;
};

/**
 * Whether an inner polygon stays within an outer one, flush edges allowed.
 *
 * Only a crossing counts against containment, so a void whose sill lies exactly
 * on the wall's own bottom edge is contained, while a void whose corner pokes
 * through the wall's side is not.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `polygonInside` produces whether an inner polygon stays within an outer one, flush edges allowed. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `polygonInside` performs inside polygon calculation when the engine checks finite planar topology before consuming geometry.
 */
export const polygonInside = (
  inner: readonly IAutoMoviePlanarPoint[],
  outer: readonly IAutoMoviePlanarPoint[],
): boolean => {
  if (inner.some((point) => pointInPolygon(point, outer) === false))
    return false;
  for (let index = 0; index < inner.length; ++index)
    for (let other = 0; other < outer.length; ++other)
      if (
        segmentsCross(
          inner[index]!,
          inner[(index + 1) % inner.length]!,
          outer[other]!,
          outer[(other + 1) % outer.length]!,
        )
      )
        return false;
  return true;
};

/**
 * Whether two polygons share any point at all, contact included.
 *
 * Contact counts because two voids meeting exactly along a jamb are one void
 * written twice, and the wall between them has nothing left to be.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `polygonsOverlap` produces whether two polygons share any point at all, contact included. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `polygonsOverlap` detects shared interior or boundary contact between two finite polygons.
 */
export const polygonsOverlap = (
  left: readonly IAutoMoviePlanarPoint[],
  right: readonly IAutoMoviePlanarPoint[],
): boolean => {
  for (let index = 0; index < left.length; ++index)
    for (let other = 0; other < right.length; ++other)
      if (
        segmentsTouch(
          left[index]!,
          left[(index + 1) % left.length]!,
          right[other]!,
          right[(other + 1) % right.length]!,
        )
      )
        return true;
  return (
    pointInPolygon(left[0]!, right) === true ||
    pointInPolygon(right[0]!, left) === true
  );
};

/**
 * The axis-aligned bounds of a polygon in its own planar frame.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-geometry-validation `polygonBounds` produces the axis-aligned bounds of a polygon in its own planar frame. This ensures degenerate or self-intersecting planar geometry is rejected before use.
 * @evidence specifications/asset-and-representation/fidelity-and-validation.md#asset-spec-validation-numeric-structure `polygonBounds` performs bounds polygon calculation when the engine checks finite planar topology before consuming geometry.
 */
export const polygonBounds = (
  polygon: readonly IAutoMoviePlanarPoint[],
): { min: IAutoMoviePlanarPoint; max: IAutoMoviePlanarPoint } => ({
  min: {
    x: Math.min(...polygon.map((point) => point.x)),
    y: Math.min(...polygon.map((point) => point.y)),
  },
  max: {
    x: Math.max(...polygon.map((point) => point.x)),
    y: Math.max(...polygon.map((point) => point.y)),
  },
});

/** Whether two segments meet at a point interior to both. */
const segmentsCross = (
  a: IAutoMoviePlanarPoint,
  b: IAutoMoviePlanarPoint,
  c: IAutoMoviePlanarPoint,
  d: IAutoMoviePlanarPoint,
): boolean => {
  const first = side(c, d, a);
  const second = side(c, d, b);
  const third = side(a, b, c);
  const fourth = side(a, b, d);
  return (
    first !== 0 &&
    second !== 0 &&
    third !== 0 &&
    fourth !== 0 &&
    first !== second &&
    third !== fourth
  );
};

/** Whether two segments share any point, endpoints and overlap included. */
const segmentsTouch = (
  a: IAutoMoviePlanarPoint,
  b: IAutoMoviePlanarPoint,
  c: IAutoMoviePlanarPoint,
  d: IAutoMoviePlanarPoint,
): boolean =>
  segmentsCross(a, b, c, d) ||
  pointOnSegment(a, c, d) ||
  pointOnSegment(b, c, d) ||
  pointOnSegment(c, a, b) ||
  pointOnSegment(d, a, b);

/** Which side of the directed line `from -> to` a point falls on. */
const side = (
  from: IAutoMoviePlanarPoint,
  to: IAutoMoviePlanarPoint,
  point: IAutoMoviePlanarPoint,
): number => {
  const cross =
    (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
  const scale = Math.max(
    1,
    Math.abs(to.x - from.x) + Math.abs(to.y - from.y),
    Math.abs(point.x - from.x) + Math.abs(point.y - from.y),
  );
  if (Math.abs(cross) <= PLANAR_EPSILON * scale) return 0;
  return cross > 0 ? 1 : -1;
};

/** Whether a point lies on a segment, its endpoints included. */
const pointOnSegment = (
  point: IAutoMoviePlanarPoint,
  from: IAutoMoviePlanarPoint,
  to: IAutoMoviePlanarPoint,
): boolean =>
  side(from, to, point) === 0 &&
  point.x >= Math.min(from.x, to.x) - PLANAR_EPSILON &&
  point.x <= Math.max(from.x, to.x) + PLANAR_EPSILON &&
  point.y >= Math.min(from.y, to.y) - PLANAR_EPSILON &&
  point.y <= Math.max(from.y, to.y) + PLANAR_EPSILON;
