import { Quaternion } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose } from "../internal/predicates";

/**
 * `Quaternion.slerp` returns the endpoints at t=0 and t=1 and the half-angle
 * rotation at t=0.5 (slerping identity→Y90 gives Y45). Underpins keyframe
 * rotation interpolation.
 */
export const test_math_quaternion_slerp = (): void => {
  const id = Quaternion.identity();
  const qY90 = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90);
  const qY45 = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 45);

  TestValidator.predicate(
    "slerp t=0 → a",
    qclose(Quaternion.slerp(id, qY90, 0), id),
  );
  TestValidator.predicate(
    "slerp t=1 → b",
    qclose(Quaternion.slerp(id, qY90, 1), qY90),
  );
  TestValidator.predicate(
    "slerp midpoint → Y45",
    qclose(Quaternion.slerp(id, qY90, 0.5), qY45),
  );
};
