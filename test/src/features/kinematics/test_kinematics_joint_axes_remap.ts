import {
  DEFAULT_JOINT_AXES,
  HUMANOID_JOINT_AXES,
  Quaternion,
  jointToQuaternion,
  resolvePose,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { qclose, vclose } from "../internal/predicates";

const X = { x: 1, y: 0, z: 0 };
const Y = { x: 0, y: 1, z: 0 };
const Z = { x: 0, y: 0, z: 1 };

const localOf = (
  pose: Parameters<typeof resolvePose>[0],
  bone: string,
  jointAxes?: Parameters<typeof resolvePose>[2],
) =>
  resolvePose(pose, createSkeleton(), jointAxes).find((r) => r.bone === bone)!
    .localRotation;

/**
 * Per-bone clinical-axis remapping (`IautomovieJointAxes` /
 * `HUMANOID_JOINT_AXES`) and its opt-in path through `resolvePose`. The default
 * basis must be exactly the historical one (flexion?뭎, abduction?뭒, twist?뭑);
 * supplying axes lets a T-pose arm's flexion swing sagittally (about Y) instead
 * of rolling along its length, without disturbing bones the table omits.
 *
 * Scenarios:
 *
 * 1. The default basis is X/Z/Y; `jointToQuaternion` with no axes equals a pure
 *    flexion about X (and is NOT the about-Y rotation ??the negative twin).
 * 2. Passing an axes override rotates about the given axis: flexion under the
 *    humanoid arm basis is a rotation about Y.
 * 3. `HUMANOID_JOINT_AXES` remaps the whole arm chain (flexion?뭑, abduction?뭒,
 *    twist?뭎) and omits legs/spine (which therefore fall back to the default).
 * 4. `resolvePose` with the table remaps an arm joint (leftUpperArm flexion ?? *    about Y) but leaves a leg joint (leftUpperLeg, absent from the table ?? *    about X) on the default basis; omitting the table reproduces the default
 *    for the same arm joint.
 */
export const test_kinematics_joint_axes_remap = (): void => {
  // 1. default basis
  TestValidator.predicate(
    "default flexion axis is X",
    vclose(DEFAULT_JOINT_AXES.flexion, X),
  );
  TestValidator.predicate(
    "default abduction axis is Z",
    vclose(DEFAULT_JOINT_AXES.abduction, Z),
  );
  TestValidator.predicate(
    "default twist axis is Y",
    vclose(DEFAULT_JOINT_AXES.twist, Y),
  );
  const flex45 = jointToQuaternion({
    flexion: 45,
    abduction: null,
    twist: null,
  });
  TestValidator.predicate(
    "default flexion rotates about X",
    qclose(flex45, Quaternion.fromAxisAngle(X, 45)),
  );
  TestValidator.predicate(
    "default flexion is NOT about Y",
    qclose(flex45, Quaternion.fromAxisAngle(Y, 45)) === false,
  );

  // 2. explicit axes override
  const armBasis = { flexion: Y, abduction: Z, twist: X };
  TestValidator.predicate(
    "flexion under arm basis rotates about Y",
    qclose(
      jointToQuaternion(
        { flexion: 45, abduction: null, twist: null },
        armBasis,
      ),
      Quaternion.fromAxisAngle(Y, 45),
    ),
  );

  // 3. the humanoid table: arm chain remapped, legs/spine omitted
  const arm = HUMANOID_JOINT_AXES.leftUpperArm!;
  TestValidator.predicate("arm flexion axis is Y", vclose(arm.flexion, Y));
  TestValidator.predicate("arm abduction axis is Z", vclose(arm.abduction, Z));
  TestValidator.predicate("arm twist axis is X", vclose(arm.twist, X));
  TestValidator.equals(
    "leg is not in the table",
    HUMANOID_JOINT_AXES.leftUpperLeg,
    undefined,
  );
  TestValidator.equals(
    "spine is not in the table",
    HUMANOID_JOINT_AXES.spine,
    undefined,
  );

  // 4. resolvePose opt-in: arm remapped, leg untouched, default reproduced
  const armPose = makePose([joint("leftUpperArm", { flexion: 40 })]);
  TestValidator.predicate(
    "resolve arm flexion with table ??about Y",
    qclose(
      localOf(armPose, "leftUpperArm", HUMANOID_JOINT_AXES),
      Quaternion.fromAxisAngle(Y, 40),
    ),
  );
  TestValidator.predicate(
    "resolve arm flexion without table ??about X (default)",
    qclose(localOf(armPose, "leftUpperArm"), Quaternion.fromAxisAngle(X, 40)),
  );
  const legPose = makePose([joint("leftUpperLeg", { flexion: 40 })]);
  TestValidator.predicate(
    "resolve leg flexion with table ??still about X (omitted)",
    qclose(
      localOf(legPose, "leftUpperLeg", HUMANOID_JOINT_AXES),
      Quaternion.fromAxisAngle(X, 40),
    ),
  );
};
