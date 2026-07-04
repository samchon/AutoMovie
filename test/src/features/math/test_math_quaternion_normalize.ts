import { Quaternion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, qunit } from "../internal/predicates";

/**
 * `Quaternion.normalize` rescales any quaternion to unit length, and degrades
 * gracefully on the degenerate zero quaternion rather than dividing by zero.
 *
 * Scenarios:
 *
 * 1. A pure-scale quaternion (0,0,0,2) normalizes onto the identity.
 * 2. An arbitrary non-unit quaternion (1,2,3,4) normalizes to unit length.
 * 3. The zero quaternion (0,0,0,0) — magnitude 0 — returns the identity instead of
 *    NaNs. Exercises the zero-length guard a normal rotation never hits.
 */
export const test_math_quaternion_normalize = (): void => {
  TestValidator.predicate(
    "normalize (0,0,0,2) → identity",
    qclose(
      Quaternion.normalize({ x: 0, y: 0, z: 0, w: 2 }),
      Quaternion.identity(),
    ),
  );
  TestValidator.predicate(
    "normalize yields a unit quaternion",
    qunit(Quaternion.normalize({ x: 1, y: 2, z: 3, w: 4 })),
  );
  TestValidator.predicate(
    "normalize of the zero quaternion → identity",
    qclose(
      Quaternion.normalize({ x: 0, y: 0, z: 0, w: 0 }),
      Quaternion.identity(),
    ),
  );
};
