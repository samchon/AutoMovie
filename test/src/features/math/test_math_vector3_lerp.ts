import { Vector3 } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * `Vector3.lerp` blends two vectors component-wise. It is the primitive the
 * motion sampler uses to interpolate a model's root translation between
 * keyframes, so its endpoints and midpoint must be exact.
 *
 * Scenarios (interpolating (0,0,0) → (2,4,6)):
 *
 * 1. T=0 returns the start vector exactly.
 * 2. T=1 returns the end vector exactly.
 * 3. T=0.5 returns the midpoint (1,2,3).
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
