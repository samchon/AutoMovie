import { Vector3 } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

/**
 * `Vector3.length` returns the Euclidean norm; `normalize` returns a unit
 * vector (and leaves the zero vector at zero rather than dividing by zero).
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
