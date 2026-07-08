import { Quaternion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, qunit } from "../internal/predicates";

/**
 * `Quaternion.inverse` is the normalized conjugate — the single source both IK
 * lowerings (two-bone, affordance seat) now share instead of a private copy.
 *
 * Scenarios:
 *
 * 1. For a unit quaternion `q`, `q * inverse(q) = identity` (the defining property
 *    of an inverse) — hand case: a 90° rotation about +Y composed with its
 *    inverse returns to identity.
 * 2. The inverse of a rotation about +Y by 90° equals a rotation about +Y by −90°
 *    (conjugate flips the vector part, keeps `w`).
 * 3. A non-unit input still yields a unit quaternion (the normalization keeps a
 *    near-unit rotation valid), so `inverse` never leaks a non-rotation.
 */
export const test_math_quaternion_inverse = (): void => {
  const y90 = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90);
  TestValidator.predicate(
    "q * inverse(q) → identity",
    qclose(
      Quaternion.multiply(y90, Quaternion.inverse(y90)),
      Quaternion.identity(),
    ),
  );
  TestValidator.predicate(
    "inverse of +Y 90° equals +Y −90°",
    qclose(
      Quaternion.inverse(y90),
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, -90),
    ),
  );
  TestValidator.predicate(
    "inverse of a non-unit quaternion is unit",
    qunit(Quaternion.inverse({ x: 1, y: 2, z: 3, w: 4 })),
  );
};
