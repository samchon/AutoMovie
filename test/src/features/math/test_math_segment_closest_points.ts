import { closestPointsBetweenSegments } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

/**
 * `closestPointsBetweenSegments` returns the closest pair (and distance)
 * between two segments using the four-candidate endpoint approximation shared
 * with the distance check, so a contact normal derived from the pair agrees
 * with the distance that flagged it.
 *
 * Scenarios:
 *
 * 1. Two colinear, separated segments: the closest pair is the facing endpoints
 *    and the distance is the gap.
 * 2. A segment endpoint lying on the other segment: the pair coincides and the
 *    distance is zero (the case a contact normal must fall back from).
 */
export const test_math_segment_closest_points = (): void => {
  const gap = closestPointsBetweenSegments(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
  );
  TestValidator.predicate("colinear gap distance", nclose(gap.distance, 1));
  TestValidator.predicate(
    "closest point on first segment",
    vclose(gap.pointA, { x: 1, y: 0, z: 0 }),
  );
  TestValidator.predicate(
    "closest point on second segment",
    vclose(gap.pointB, { x: 2, y: 0, z: 0 }),
  );

  const touching = closestPointsBetweenSegments(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
  );
  TestValidator.predicate(
    "touching distance zero",
    nclose(touching.distance, 0),
  );
  TestValidator.predicate(
    "touching points coincide",
    vclose(touching.pointA, touching.pointB),
  );
};
