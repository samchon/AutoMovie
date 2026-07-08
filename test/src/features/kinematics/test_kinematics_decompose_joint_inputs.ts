import { Quaternion, decomposeJointRotation } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * `decomposeJointRotation` can be called directly with runtime-provided
 * quaternions and custom joint axes. Non-finite inputs must fail at the helper
 * boundary before vector extraction can emit non-finite clinical angles.
 *
 * Scenarios:
 *
 * 1. Non-finite quaternion components throw.
 * 2. Non-finite custom joint-axis components throw.
 * 3. A valid quaternion and axis basis still decomposes normally.
 */
export const test_kinematics_decompose_joint_inputs = (): void => {
  const validAxes = {
    flexion: { x: 0, y: 1, z: 0 },
    abduction: { x: 0, y: 0, z: 1 },
    twist: { x: 1, y: 0, z: 0 },
  };

  TestValidator.predicate(
    "NaN quaternion component rejects",
    throwsError(
      () => decomposeJointRotation({ x: Number.NaN, y: 0, z: 0, w: 1 }),
      ["decomposeJointRotation quaternion.x", "finite", "NaN"],
    ),
  );

  TestValidator.predicate(
    "infinite quaternion component rejects",
    throwsError(
      () => decomposeJointRotation({ x: 0, y: 0, z: 0, w: Infinity }),
      ["decomposeJointRotation quaternion.w", "finite", "Infinity"],
    ),
  );

  TestValidator.predicate(
    "non-finite custom axis rejects",
    throwsError(
      () =>
        decomposeJointRotation(Quaternion.identity(), {
          flexion: { x: 1, y: 0, z: 0 },
          abduction: { x: 0, y: Infinity, z: 1 },
          twist: { x: 0, y: 1, z: 0 },
        }),
      ["decomposeJointRotation axes.abduction.y", "finite", "Infinity"],
    ),
  );

  TestValidator.predicate(
    "zero-length custom axis rejects",
    throwsError(
      () =>
        decomposeJointRotation(Quaternion.identity(), {
          ...validAxes,
          twist: { x: 0, y: 0, z: 0 },
        }),
      ["decomposeJointRotation axes.twist", "non-zero"],
    ),
  );

  TestValidator.predicate(
    "collinear custom axes reject",
    throwsError(
      () =>
        decomposeJointRotation(Quaternion.identity(), {
          ...validAxes,
          twist: { x: 0, y: 2, z: 0 },
        }),
      ["decomposeJointRotation axes.twist", "orthogonal"],
    ),
  );

  TestValidator.predicate(
    "non-orthogonal custom axes reject",
    throwsError(
      () =>
        decomposeJointRotation(Quaternion.identity(), {
          ...validAxes,
          twist: { x: 1, y: 0, z: 1 },
        }),
      ["decomposeJointRotation axes.twist", "orthogonal"],
    ),
  );

  const valid = decomposeJointRotation(
    Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 25),
  );
  TestValidator.equals("valid twist decomposes", Math.round(valid.twist), 25);

  const normalized = decomposeJointRotation(
    Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 25),
    {
      flexion: { x: 2, y: 0, z: 0 },
      abduction: { x: 0, y: 0, z: 3 },
      twist: { x: 0, y: 4, z: 0 },
    },
  );
  TestValidator.equals(
    "valid non-unit orthogonal axes normalize before decomposing",
    Math.round(normalized.twist),
    25,
  );
};
