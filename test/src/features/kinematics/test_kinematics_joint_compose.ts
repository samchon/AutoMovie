import { Quaternion, jointToQuaternion } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, qunit } from "../internal/predicates";

/**
 * When more than one axis is articulated, `jointToQuaternion` composes them in
 * the documented order — twist ∘ abduction ∘ flexion — and the product is
 * always a unit quaternion (a pure rotation, no scaling). The order matters
 * because quaternion multiplication does not commute.
 *
 * Scenario: a joint with flexion 90° and twist 90° must equal multiplying the
 * twist quaternion onto the flexion quaternion in that order, and the combined
 * rotation must remain unit-norm.
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
