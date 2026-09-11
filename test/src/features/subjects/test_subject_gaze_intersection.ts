import { TestValidator } from "@nestia/e2e";

import {
  portraitPoint as p,
  portraitRayIntersection,
} from "../../subjects/geometry";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A gaze marker must move on its measured camera ray when depth is corrected.
 *
 * Scenarios:
 * 1. A slanted ray meets Z=4 at (2,1,4), retaining its two camera-plane invariants.
 * 2. A descending ray and roots at either bracket endpoint remain valid.
 * 3. An unbracketed plane and either non-finite endpoint are refused explicitly.
 */
export const test_subject_gaze_intersection = (): void => {
  const point = portraitRayIntersection(
    p(0, 0, 0),
    p(0.5, 0.25, 1),
    () => 4,
    [0, 10],
  );
  TestValidator.predicate(
    "ray-plane intersection",
    nclose(point.x, 2) && nclose(point.y, 1) && nclose(point.z, 4),
  );
  TestValidator.predicate(
    "camera-plane invariants",
    nclose(point.x - 0.5 * point.z, 0) && nclose(point.y - 0.25 * point.z, 0),
  );
  const descending = portraitRayIntersection(
    p(0, 0, 10),
    p(0, 0, -1),
    () => 4,
    [0, 10],
  );
  TestValidator.predicate("descending ray", nclose(descending.z, 4));
  TestValidator.predicate(
    "lower endpoint",
    nclose(
      portraitRayIntersection(p(0, 0, 0), p(0, 0, 1), () => 0, [0, 10]).z,
      0,
    ),
  );
  TestValidator.predicate(
    "upper endpoint",
    nclose(
      portraitRayIntersection(p(0, 0, 0), p(0, 0, 1), () => 10, [0, 10]).z,
      10,
    ),
  );
  TestValidator.predicate(
    "unbracketed surface",
    throwsError(() =>
      portraitRayIntersection(p(0, 0, 0), p(0, 0, 1), () => 20, [0, 10]),
    ),
  );
  TestValidator.predicate(
    "non-finite lower endpoint",
    throwsError(() =>
      portraitRayIntersection(
        p(0, 0, 0),
        p(1, 0, 1),
        (x) => (x === 0 ? Infinity : 4),
        [0, 10],
      ),
    ),
  );
  TestValidator.predicate(
    "non-finite upper endpoint",
    throwsError(() =>
      portraitRayIntersection(
        p(0, 0, 0),
        p(1, 0, 1),
        (x) => (x === 10 ? Infinity : 4),
        [0, 10],
      ),
    ),
  );
};
