import { Quaternion, jointToQuaternion } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose } from "../internal/predicates";

/**
 * `jointToQuaternion` maps each clinical axis to its documented local axis:
 * flexion→X, abduction→Z, twist→Y. With no articulation it is the identity.
 */
export const test_kinematics_joint_axes = (): void => {
  const id = Quaternion.identity();
  TestValidator.predicate(
    "null axes → identity",
    qclose(
      jointToQuaternion({ flexion: null, abduction: null, twist: null }),
      id,
    ),
  );
  TestValidator.predicate(
    "zero axes → identity",
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
