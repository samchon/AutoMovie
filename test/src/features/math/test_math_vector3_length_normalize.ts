import { Vector3 } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

/**
 * `Vector3.length` returns the Euclidean norm and `normalize` returns a unit
 * vector pointing the same way, degrading gracefully on the zero vector rather
 * than dividing by zero. These underpin every distance check and direction
 * computation in the engine.
 *
 * Scenarios:
 *
 * 1. The 3–4–5 right triangle pins the norm: length (3,4,0) → 5; and the zero
 *    vector has length 0.
 * 2. Normalizing (3,4,0) yields a vector of length 1.
 * 3. Normalization preserves direction: (5,0,0) → (1,0,0).
 * 4. The degenerate zero vector normalizes back to zero (the divide-by-zero guard)
 *    instead of producing NaNs.
 */
export const test_math_vector3_length_normalize = (): void => {
  TestValidator.equals("3-4-5 length", Vector3.length({ x: 3, y: 4, z: 0 }), 5);
  TestValidator.equals("zero length", Vector3.length(Vector3.create()), 0);
  TestValidator.predicate(
    "normalized vector is unit",
    nclose(Vector3.length(Vector3.normalize({ x: 3, y: 4, z: 0 })), 1),
  );
  TestValidator.predicate(
    "normalize keeps direction",
    vclose(Vector3.normalize({ x: 5, y: 0, z: 0 }), { x: 1, y: 0, z: 0 }),
  );
  TestValidator.predicate(
    "normalize of zero stays zero",
    vclose(Vector3.normalize(Vector3.create()), Vector3.create()),
  );
};
