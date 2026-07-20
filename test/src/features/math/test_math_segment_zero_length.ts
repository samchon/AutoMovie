import {
  pointSegmentDistance,
  segmentSegmentDistance,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * A zero-length segment (`start === end`, e.g. two bones the FK resolves onto
 * the same world point) must not poison the shared distance oracle. Before the
 * `Number.EPSILON` span floor, the segment direction `end - start` is the zero
 * vector, so the projection `0/0` was `NaN`, `lerp(start, end, NaN)` was `NaN`,
 * and the distance came back `NaN`, which slips every `distance < minimum`
 * collision test as `false`, silently passing a real overlap.
 *
 * `nclose` fails on `NaN` (it requires `Number.isFinite`), so each assertion
 * here would have failed under the old code and passes only with the guard.
 *
 * Scenarios:
 *
 * 1. Point to a zero-length segment: the exact point-to-endpoint distance
 *    (`(3,4,0)` to the collapsed segment at the origin is `5`), degrading to
 *    the correct point-to-point measure rather than `NaN`.
 * 2. A zero-length segment overlapping a real segment: the four-candidate minimum
 *    is the true `0`, not `NaN`: the case a capsule whose centerline collapses
 *    to a point must still flag when another capsule passes through it.
 * 3. A zero-length segment clear of a real segment: a finite, exact gap.
 */
export const test_math_segment_zero_length = (): void => {
  const origin = { x: 0, y: 0, z: 0 };

  TestValidator.predicate(
    "point to collapsed segment is the point-to-point distance",
    nclose(pointSegmentDistance({ x: 3, y: 4, z: 0 }, origin, origin), 5),
  );

  // A collapsed segment sitting on the x-axis segment [(-1,0,0),(1,0,0)]:
  // the true minimum distance is 0 (the point lies on the segment). The old
  // code returned NaN because the two collapsed-segment candidates were NaN and
  // Math.min(..., NaN) === NaN.
  TestValidator.predicate(
    "collapsed segment overlapping a real segment measures zero",
    nclose(
      segmentSegmentDistance(
        origin,
        origin,
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ),
      0,
    ),
  );

  // The same collapsed segment lifted 2m above the x-axis segment: an exact,
  // finite gap of 2 rather than NaN.
  TestValidator.predicate(
    "collapsed segment clear of a real segment measures the exact gap",
    nclose(
      segmentSegmentDistance(
        { x: 0, y: 2, z: 0 },
        { x: 0, y: 2, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ),
      2,
    ),
  );
};
