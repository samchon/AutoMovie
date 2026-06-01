import { Quaternion, jointToQuaternion } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, qunit } from "../internal/predicates";

/**
 * `jointToQuaternion` composes axes in the documented order twist ∘ abduction ∘
 * flexion, and the result is always a unit quaternion.
 */
export const test_kinematics_joint_compose = (): void => {
  const composed = jointToQuaternion({
    flexion: 90,
    abduction: null,
    twist: 90,
  });
  const expected = Quaternion.multiply(
    Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90),
    Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, 90),
  );
  TestValidator.predicate("twist ∘ flexion order", qclose(composed, expected));
  TestValidator.predicate("composition is unit", qunit(composed));
};
