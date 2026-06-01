import { Quaternion } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, qunit } from "../internal/predicates";

/**
 * Quaternion identity is the multiplicative neutral, multiplication composes
 * rotations (two 90° turns about Y equal one 180° turn), and the product of
 * unit quaternions stays unit.
 */
export const test_math_quaternion_identity_multiply = (): void => {
  const id = Quaternion.identity();
  const qY90 = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90);

  TestValidator.predicate(
    "identity * q = q",
    qclose(Quaternion.multiply(id, qY90), qY90),
  );
  TestValidator.predicate(
    "q * identity = q",
    qclose(Quaternion.multiply(qY90, id), qY90),
  );
  TestValidator.predicate(
    "Y90 ∘ Y90 = Y180",
    qclose(
      Quaternion.multiply(qY90, qY90),
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 180),
    ),
  );
  TestValidator.predicate(
    "product of unit quats is unit",
    qunit(
      Quaternion.multiply(
        qY90,
        Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, 37),
      ),
    ),
  );
};
