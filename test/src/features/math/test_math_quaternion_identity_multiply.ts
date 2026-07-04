import { Quaternion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, qunit } from "../internal/predicates";

/**
 * Quaternion identity is the multiplicative neutral, multiplication composes
 * rotations (two 90째 turns about Y equal one 180째 turn), the product of unit
 * quaternions stays unit, and a degenerate zero rotation axis collapses to the
 * identity rather than producing NaNs.
 *
 * Scenarios:
 *
 * 1. Identity is neutral on both sides of `multiply`.
 * 2. Composing Y90 with itself yields Y180.
 * 3. The product of two unit quaternions is unit.
 * 4. `fromAxisAngle` on a zero-length axis returns the identity (the zero-axis
 *    guard a real rotation axis never reaches).
 */
export const test_math_quaternion_identity_multiply = (): void => {
  const id = Quaternion.identity();
  const qY90 = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90);

  TestValidator.predicate(
    "zero-length axis ??identity",
    qclose(Quaternion.fromAxisAngle({ x: 0, y: 0, z: 0 }, 90), id),
  );

  TestValidator.predicate(
    "identity * q = q",
    qclose(Quaternion.multiply(id, qY90), qY90),
  );
  TestValidator.predicate(
    "q * identity = q",
    qclose(Quaternion.multiply(qY90, id), qY90),
  );
  TestValidator.predicate(
    "Y90 ??Y90 = Y180",
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
