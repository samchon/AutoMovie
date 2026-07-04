import {
  IautomovieJointAxes,
  Quaternion,
  decomposeJointRotation,
  jointToQuaternion,
} from "@automovie/engine";
import { IautomovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { vclose } from "../internal/predicates";

const DEFAULT_AXES: IautomovieJointAxes = {
  flexion: { x: 1, y: 0, z: 0 },
  abduction: { x: 0, y: 0, z: 1 },
  twist: { x: 0, y: 1, z: 0 },
};
// The humanoid arm basis (flexion?뭑, abduction?뭒, twist?뭎): right-handed.
const ARM_AXES: IautomovieJointAxes = {
  flexion: { x: 0, y: 1, z: 0 },
  abduction: { x: 0, y: 0, z: 1 },
  twist: { x: 1, y: 0, z: 0 },
};

const PROBES: IautomovieVector3[] = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0.4, y: -0.7, z: 0.55 },
];

/** Same rotation iff both send every probe vector to the same place. */
const rotationsMatch = (
  q: ReturnType<typeof jointToQuaternion>,
  r: ReturnType<typeof jointToQuaternion>,
): boolean =>
  PROBES.every((v) =>
    vclose(Quaternion.rotateVector(q, v), Quaternion.rotateVector(r, v), 1e-4),
  );

/**
 * `decomposeJointRotation` ??the inverse of `jointToQuaternion`. The contract
 * is the round-trip: `jointToQuaternion(decompose(q, axes), axes)` is the same
 * rotation as `q`, for any bone-local rotation and any orthonormal axis basis
 * (right- or left-handed). This is the lowering an IK solver needs ??quaternion
 * bone rotations back into clinical flexion/abduction/twist.
 *
 * Scenarios:
 *
 * 1. Round-trip on the right-handed arm basis for a spread of angle triples (pure
 *    flexion / abduction / twist, and mixed) ??the reconstructed rotation
 *    matches the original on every probe vector.
 * 2. Round-trip on the left-handed default clinical basis (flex횞abd = ?뭪wist),
 *    exercising the handedness correction ??same match.
 * 3. Gimbal lock: abduction at exactly 짹90째 (flexion folds into twist) still
 *    round-trips, and the recovered abduction is 짹90 with flexion pinned to 0.
 * 4. Pure-axis recovery reads the exact clinical angle back: a 40째 flexion
 *    decomposes to flexion 40, abduction 0, twist 0 (arm basis).
 */
export const test_kinematics_decompose_joint = (): void => {
  const triples = [
    { flexion: 40, abduction: 0, twist: 0 },
    { flexion: 0, abduction: 35, twist: 0 },
    { flexion: 0, abduction: 0, twist: 55 },
    { flexion: 25, abduction: -20, twist: 15 },
    { flexion: -50, abduction: 30, twist: -40 },
    { flexion: 70, abduction: -60, twist: 80 },
  ];

  for (const axes of [ARM_AXES, DEFAULT_AXES])
    for (const t of triples) {
      const q = jointToQuaternion(t, axes);
      const back = decomposeJointRotation(q, axes);
      const q2 = jointToQuaternion(back, axes);
      TestValidator.predicate(
        `round-trips ${JSON.stringify(t)} (${axes === ARM_AXES ? "arm" : "default"})`,
        rotationsMatch(q, q2),
      );
    }

  // 3. gimbal lock at 짹90째 abduction
  for (const abduction of [90, -90]) {
    const q = jointToQuaternion(
      { flexion: 20, abduction, twist: 30 },
      ARM_AXES,
    );
    const back = decomposeJointRotation(q, ARM_AXES);
    TestValidator.predicate(
      `gimbal ${abduction}째 pins flexion 0, keeps abduction`,
      back.flexion === 0 && Math.abs(Math.abs(back.abduction) - 90) < 1e-6,
    );
    TestValidator.predicate(
      `gimbal ${abduction}째 still round-trips`,
      rotationsMatch(q, jointToQuaternion(back, ARM_AXES)),
    );
  }

  // 4. pure-axis recovery reads the exact angle
  const pure = decomposeJointRotation(
    jointToQuaternion({ flexion: 40, abduction: 0, twist: 0 }, ARM_AXES),
    ARM_AXES,
  );
  TestValidator.predicate(
    "a pure 40째 flexion decomposes back to (40, 0, 0)",
    Math.abs(pure.flexion - 40) < 1e-4 &&
      Math.abs(pure.abduction) < 1e-4 &&
      Math.abs(pure.twist) < 1e-4,
  );
};
