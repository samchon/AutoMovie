import { Quaternion, jointToQuaternion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { qclose, throwsError } from "../internal/predicates";

/**
 * `jointToQuaternion` is also called directly at runtime, outside the schema
 * validators. Non-finite joint angles or custom axes must stop at this boundary
 * instead of becoming a quaternion with non-finite components.
 *
 * Scenarios:
 *
 * 1. Non-finite flexion/abduction/twist values throw.
 * 2. Non-finite custom axis components throw.
 * 3. A valid custom axis still composes as before.
 */
export const test_kinematics_joint_to_quaternion_inputs = (): void => {
  const base = { flexion: null, abduction: null, twist: null };

  TestValidator.predicate(
    "NaN flexion rejects",
    throwsError(
      () => jointToQuaternion({ ...base, flexion: Number.NaN }),
      ["jointToQuaternion flexion", "finite", "NaN"],
    ),
  );
  TestValidator.predicate(
    "infinite abduction rejects",
    throwsError(
      () => jointToQuaternion({ ...base, abduction: Infinity }),
      ["jointToQuaternion abduction", "finite", "Infinity"],
    ),
  );
  TestValidator.predicate(
    "negative infinite twist rejects",
    throwsError(
      () => jointToQuaternion({ ...base, twist: -Infinity }),
      ["jointToQuaternion twist", "finite", "-Infinity"],
    ),
  );

  TestValidator.predicate(
    "non-finite custom flexion axis rejects",
    throwsError(
      () =>
        jointToQuaternion(
          { flexion: 15, abduction: null, twist: null },
          {
            flexion: { x: Number.NaN, y: 0, z: 0 },
            abduction: { x: 0, y: 0, z: 1 },
            twist: { x: 0, y: 1, z: 0 },
          },
        ),
      ["jointToQuaternion axes.flexion.x", "finite", "NaN"],
    ),
  );

  TestValidator.predicate(
    "valid custom axis still rotates",
    qclose(
      jointToQuaternion(
        { flexion: 30, abduction: null, twist: null },
        {
          flexion: { x: 0, y: 1, z: 0 },
          abduction: { x: 0, y: 0, z: 1 },
          twist: { x: 1, y: 0, z: 0 },
        },
      ),
      Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 30),
    ),
  );
};
