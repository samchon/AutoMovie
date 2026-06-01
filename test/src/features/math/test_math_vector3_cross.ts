import { Vector3 } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * `Vector3.cross` must follow the right-handed convention X×Y=Z, Y×Z=X, Z×X=Y,
 * and be anti-commutative. Pins the handedness the whole engine assumes.
 */
export const test_math_vector3_cross = (): void => {
  const X = Vector3.create(1, 0, 0);
  const Y = Vector3.create(0, 1, 0);
  const Z = Vector3.create(0, 0, 1);
  TestValidator.equals("X×Y=Z", Vector3.cross(X, Y), Z);
  TestValidator.equals("Y×Z=X", Vector3.cross(Y, Z), X);
  TestValidator.equals("Z×X=Y", Vector3.cross(Z, X), Y);
  TestValidator.equals("anti-commutative", Vector3.cross(Y, X), {
    x: 0,
    y: 0,
    z: -1,
  });
};
