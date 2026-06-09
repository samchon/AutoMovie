import { Quaternion } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { vclose } from "../internal/predicates";

/**
 * `Quaternion.rotateVector` applies a rotation to a vector. The _direction_ it
 * turns is the convention the entire kinematics layer depends on, so it is
 * pinned against known right-handed results.
 *
 * Scenarios:
 *
 * 1. A +90° turn about +Y sends +X to −Z (the right-hand rule).
 * 2. A +180° turn about +Y sends +X to −X.
 * 3. The identity rotation leaves the vector unchanged.
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
