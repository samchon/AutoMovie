import {
  closestPointOnSegmentXZ,
  convexHull2D,
  nearestHullEdge,
  pointHullDistance,
  pointInHull,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

const v = (x: number, z: number) => ({ x, y: 0, z });

/**
 * The shared 2D convex hull over the XZ plane underpins support and balance, so
 * it must be deterministic and order-independent, and its point queries must be
 * exact against hand math.
 *
 * Scenarios:
 *
 * 1. A square with an interior point → hull is the four corners; the interior
 *    point is dropped.
 * 2. Duplicate points collapse; three collinear points collapse to two extremes;
 *    one/zero points pass through; an equal-x column exercises the secondary
 *    sort key.
 * 3. PointInHull: inside true, outside false, a degenerate (<3-vertex) hull
 *    encloses nothing.
 * 4. PointHullDistance: 0 inside, the edge gap outside, the vertex distance for a
 *    point hull, the segment distance for a 2-vertex hull, Infinity for empty.
 * 5. NearestHullEdge: the nearest boundary edge and its distance; a single-vertex
 *    hull degenerates to a zero-length edge.
 * 6. ClosestPointOnSegmentXZ clamps before the start, projects onto the middle,
 *    clamps past the end, and survives a zero-length segment.
 */
export const test_math_convex_hull = (): void => {
  const square = convexHull2D([v(0, 0), v(2, 0), v(2, 2), v(0, 2), v(1, 1)]);
  TestValidator.equals("square hull drops interior point", square.length, 4);
  TestValidator.equals(
    "duplicate points collapse",
    convexHull2D([v(0, 0), v(0, 0), v(1, 0)]).length,
    2,
  );
  TestValidator.equals(
    "collinear collapses to two extremes",
    convexHull2D([v(0, 0), v(1, 0), v(2, 0)]).length,
    2,
  );
  TestValidator.equals("single point hull", convexHull2D([v(5, 5)]).length, 1);
  TestValidator.equals("empty hull", convexHull2D([]).length, 0);
  TestValidator.equals(
    "equal-x column builds a triangle",
    convexHull2D([v(0, 2), v(0, 0), v(2, 1)]).length,
    3,
  );

  TestValidator.equals("inside the square", pointInHull(v(1, 1), square), true);
  TestValidator.equals(
    "outside the square",
    pointInHull(v(3, 1), square),
    false,
  );
  TestValidator.equals(
    "a segment hull encloses nothing",
    pointInHull(v(0, 0), convexHull2D([v(0, 0), v(1, 0)])),
    false,
  );

  TestValidator.predicate(
    "distance inside is 0",
    nclose(pointHullDistance(v(1, 1), square), 0),
  );
  TestValidator.predicate(
    "distance outside is the edge gap",
    nclose(pointHullDistance(v(3, 1), square), 1),
  );
  TestValidator.predicate(
    "distance to a single vertex",
    nclose(pointHullDistance(v(3, 0), [v(0, 0)]), 3),
  );
  TestValidator.predicate(
    "distance to empty is Infinity",
    pointHullDistance(v(0, 0), []) === Infinity,
  );
  TestValidator.predicate(
    "distance to a segment hull",
    nclose(pointHullDistance(v(1, 1), [v(0, 0), v(2, 0)]), 1),
  );

  const edge = nearestHullEdge(v(3, 1), square);
  TestValidator.predicate("nearest edge distance", nclose(edge.distance, 1));
  const single = nearestHullEdge(v(3, 0), [v(0, 0)]);
  TestValidator.predicate(
    "single-vertex hull yields a zero-length edge",
    nclose(single.distance, 3) && vclose(single.start, single.end),
  );

  TestValidator.predicate(
    "clamp before the start",
    vclose(closestPointOnSegmentXZ(v(-1, 0), v(0, 0), v(2, 0)), v(0, 0)),
  );
  TestValidator.predicate(
    "project onto the middle",
    vclose(closestPointOnSegmentXZ(v(1, 1), v(0, 0), v(2, 0)), v(1, 0)),
  );
  TestValidator.predicate(
    "clamp past the end",
    vclose(closestPointOnSegmentXZ(v(3, 0), v(0, 0), v(2, 0)), v(2, 0)),
  );
  TestValidator.predicate(
    "zero-length segment returns its point",
    vclose(closestPointOnSegmentXZ(v(1, 1), v(5, 5), v(5, 5)), v(5, 5)),
  );
};
