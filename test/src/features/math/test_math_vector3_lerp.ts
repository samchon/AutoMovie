import { Vector3 } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * `Vector3.lerp` interpolates component-wise: at t=0 it returns `a`, at t=1 it
 * returns `b`, and at t=0.5 the midpoint. Underpins motion translation
 * blending.
 */
export const test_math_vector3_lerp = (): void => {
  const a = Vector3.create(0, 0, 0);
  const b = Vector3.create(2, 4, 6);
  TestValidator.equals("lerp at 0", Vector3.lerp(a, b, 0), a);
  TestValidator.equals("lerp at 1", Vector3.lerp(a, b, 1), b);
  TestValidator.equals("lerp midpoint", Vector3.lerp(a, b, 0.5), {
    x: 1,
    y: 2,
    z: 3,
  });
};
