import { Quaternion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, qunit } from "../internal/predicates";

const Y = { x: 0, y: 1, z: 0 };
const yaw = (deg: number) => Quaternion.fromAxisAngle(Y, deg);

/**
 * `Quaternion.slerp` interpolates rotations along the shortest arc, and must
 * handle all three numerical regimes its implementation branches on: the
 * ordinary acos path, the opposite-hemisphere sign flip, and the near-parallel
 * lerp fallback. Underpins keyframe rotation interpolation, where any of these
 * can occur depending on how far apart two keyframe poses are.
 *
 * Scenarios:
 *
 * 1. Ordinary arc (identity → Y90, dot ≈ 0.707 > 0): endpoints are returned at t=0
 *    and t=1, and the midpoint is the half-angle rotation Y45.
 * 2. Opposite hemisphere (identity → Y200, dot = cos 100° < 0): the implementation
 *    negates `b` to take the shorter arc, so the t=0.5 result is Y(−80°), the
 *    short-way midpoint, not the long-way Y100. Pins that slerp never takes the
 *    long way around. (Endpoints still hold up to sign, since q and −q are the
 *    same rotation.)
 * 3. Near-parallel (identity → Y0.4, dot ≈ 0.99999 > 0.9995): slerp falls back to
 *    a normalized lerp to avoid dividing by sin θ ≈ 0; the midpoint is still ≈
 *    Y0.2 to a looser tolerance.
 */
export const test_math_quaternion_slerp = (): void => {
  const id = Quaternion.identity();

  // 1. ordinary arc
  TestValidator.predicate(
    "ordinary: t=0 → a",
    qclose(Quaternion.slerp(id, yaw(90), 0), id),
  );
  TestValidator.predicate(
    "ordinary: t=1 → b",
    qclose(Quaternion.slerp(id, yaw(90), 1), yaw(90)),
  );
  TestValidator.predicate(
    "ordinary: midpoint → Y45",
    qclose(Quaternion.slerp(id, yaw(90), 0.5), yaw(45)),
  );

  // 2. opposite hemisphere: shorter arc means the midpoint is Y(−80°)
  const far = yaw(200);
  TestValidator.predicate(
    "opposite: t=1 → b (up to sign)",
    qclose(Quaternion.slerp(id, far, 1), far),
  );
  TestValidator.predicate(
    "opposite: midpoint takes short arc → Y(−80)",
    qclose(Quaternion.slerp(id, far, 0.5), yaw(-80), 1e-3),
  );
  TestValidator.predicate(
    "opposite: midpoint is unit",
    qunit(Quaternion.slerp(id, far, 0.5)),
  );

  // 3. near-parallel: lerp fallback
  const near = yaw(0.4);
  TestValidator.predicate(
    "near-parallel: midpoint ≈ Y0.2",
    qclose(Quaternion.slerp(id, near, 0.5), yaw(0.2), 1e-3),
  );
  TestValidator.predicate(
    "near-parallel: midpoint is unit",
    qunit(Quaternion.slerp(id, near, 0.5)),
  );
};
