import { Quaternion, jointToQuaternion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose } from "../internal/predicates";

/**
 * `jointToQuaternion` turns the semantic angles an LLM emits (flexion /
 * abduction / twist) into a bone-local quaternion, mapping each clinical axis
 * to its documented local rotation axis. Getting this mapping right is what
 * makes a generated pose render in the direction it was meant to.
 *
 * Scenarios:
 *
 * 1. No articulation ??all axes null, or all zero ??yields the identity.
 * 2. Flexion rotates about local X.
 * 3. Abduction rotates about local Z.
 * 4. Twist rotates about local Y.
 */
export const test_kinematics_joint_axes = (): void => {
  const id = Quaternion.identity();
  TestValidator.predicate(
    "null axes ??identity",
    qclose(
      jointToQuaternion({ flexion: null, abduction: null, twist: null }),
      id,
    ),
  );
  TestValidator.predicate(
    "zero axes ??identity",
    qclose(jointToQuaternion({ flexion: 0, abduction: 0, twist: 0 }), id),
  );

  TestValidator.predicate(
    "flexion about X",
    qclose(
      jointToQuaternion({ flexion: 90, abduction: null, twist: null }),
      Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, 90),
    ),
  );
  TestValidator.predicate(
    "abduction about Z",
    qclose(
      jointToQuaternion({ flexion: null, abduction: 90, twist: null }),
      Quaternion.fromAxisAngle({ x: 0, y: 0, z: 1 }, 90),
    ),
  );
  TestValidator.predicate(
    "twist about Y",
    qclose(
      jointToQuaternion({ flexion: null, abduction: null, twist: 90 }),
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90),
    ),
  );
};
