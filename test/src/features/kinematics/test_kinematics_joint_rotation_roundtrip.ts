import { decomposeJointRotation, jointToQuaternion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose } from "../internal/predicates";
import { makeRng, randomUnitQuaternion } from "../internal/random";

/**
 * The clinical-angle decomposition (`decomposeJointRotation`) is the inverse of
 * `jointToQuaternion`, and its JSDoc claims the composition round-trips for ANY
 * rotation — including the gimbal-lock corner (abduction ≈ ±90°), where flexion
 * folds into twist but the reconstructed rotation is still identical. A
 * property sweep is the honest way to assert "any": hand fixtures cannot
 * enumerate the sphere, and gimbal is exactly the case a fixture author
 * forgets.
 *
 * Scenario:
 *
 * 1. Over 256 seeded random rotations, `jointToQuaternion(decompose(q))`
 *    reproduces `q` up to sign (a quaternion and its negation are one
 *    rotation). The quaternion round-trips even where the angles cannot
 *    (gimbal), which is the property the IK lowering relies on.
 */
export const test_kinematics_joint_rotation_roundtrip = (): void => {
  const rng = makeRng(0x2f9a10c3);
  for (let i = 0; i < 256; ++i) {
    const q = randomUnitQuaternion(rng);
    const recomposed = jointToQuaternion(decomposeJointRotation(q));
    TestValidator.predicate(
      `jointToQuaternion(decompose(q)) round-trips #${i}`,
      qclose(recomposed, q),
    );
  }
};
