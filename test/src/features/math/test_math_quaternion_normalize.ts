import { Quaternion } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, qunit } from "../internal/predicates";

/**
 * `Quaternion.normalize` rescales to unit length (collapsing a pure-scale
 * quaternion onto the identity) and yields a unit quaternion for any non-zero
 * input.
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
};
