import { Vector3 } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * `Vector3` add / subtract / scale / dot are the textbook component-wise
 * operations, and form the arithmetic the rest of the engine's geometry is
 * built on. All inputs are chosen so the results are exact integers, so each is
 * checked with direct equality rather than a tolerance.
 *
 * Scenarios:
 *
 * 1. Add (1,2,3)+(4,5,6) ??(5,7,9), the per-component sum.
 * 2. Subtract (4,5,6)??1,2,3) ??(3,3,3).
 * 3. Scale (1,2,3)쨌2 ??(2,4,6).
 * 4. Dot (1,2,3)쨌(4,5,6) ??32, and the dot of two perpendicular axes is 0 ?? *    pinning the orthogonality the projection and lighting math rely on.
 */
export const test_math_vector3_arithmetic = (): void => {
  const a = Vector3.create(1, 2, 3);
  const b = Vector3.create(4, 5, 6);
  TestValidator.equals("add", Vector3.add(a, b), { x: 5, y: 7, z: 9 });
  TestValidator.equals("subtract", Vector3.subtract(b, a), {
    x: 3,
    y: 3,
    z: 3,
  });
  TestValidator.equals("scale", Vector3.scale(a, 2), { x: 2, y: 4, z: 6 });
  TestValidator.equals("dot", Vector3.dot(a, b), 32);
  TestValidator.equals(
    "dot orthogonal is zero",
    Vector3.dot({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }),
    0,
  );
};
