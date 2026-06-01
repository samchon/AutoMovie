import { Quaternion } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { vclose } from "../internal/predicates";

/**
 * `Quaternion.rotateVector` applies the rotation: a +90° turn about +Y sends +X
 * to −Z (right-handed), a +180° turn sends +X to −X, and the identity leaves
 * the vector unchanged. Pins the rotation direction the kinematics layer relies
 * on.
 */
export const test_math_quaternion_rotate_vector = (): void => {
  const X = { x: 1, y: 0, z: 0 };
  const qY90 = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90);
  const qY180 = Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 180);

  TestValidator.predicate(
    "X by Y90 → -Z",
    vclose(Quaternion.rotateVector(qY90, X), { x: 0, y: 0, z: -1 }),
  );
  TestValidator.predicate(
    "X by Y180 → -X",
    vclose(Quaternion.rotateVector(qY180, X), { x: -1, y: 0, z: 0 }),
  );
  TestValidator.predicate(
    "identity leaves vector",
    vclose(Quaternion.rotateVector(Quaternion.identity(), X), X),
  );
};
