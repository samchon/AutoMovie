import {
  DEFAULT_JOINT_AXES,
  IAutoFilmRestFrame,
  decomposeJointRotation,
  jointToQuaternion,
  toClinicalAngle,
  toRigAngle,
} from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose, qclose } from "../internal/predicates";

/**
 * The rest-frame angle maps that let a pose be authored in one **clinical**
 * convention (e.g. +abduction raises either arm) while the rig articulates in
 * its own per-side rest-relative space: `jointToQuaternion` reads clinical and
 * maps in (`r = (c − neutral) / sign`), `decomposeJointRotation` lifts the
 * recovered rig angle back out (`c = sign·r + neutral`).
 *
 * Scenarios:
 *
 * 1. `toRigAngle` / `toClinicalAngle` are inverses; a `null` angle and an absent
 *    frame both pass through as the identity.
 * 2. Feeding `jointToQuaternion` a clinical angle with a frame equals feeding it
 *    the pre-converted rig angle with no frame.
 * 3. `decompose(jointToQuaternion(c, axes, f), axes, f)` round-trips the clinical
 *    angles — including the gimbal case (abduction at the rig's ±90°).
 */
export const test_kinematics_rest_frame_angles = (): void => {
  // right-arm-like: abduction mirrors (sign −1) and rests at 90° (a T-pose arm)
  const frame: IAutoFilmRestFrame = { abduction: { sign: -1, neutral: 90 } };

  // 1. inverses + identities
  TestValidator.predicate(
    "clinical → rig maps by (c − neutral)/sign",
    nclose(toRigAngle(150, frame.abduction)!, -60),
  );
  TestValidator.predicate(
    "rig → clinical maps by sign·r + neutral",
    nclose(toClinicalAngle(-60, frame.abduction)!, 150),
  );
  TestValidator.predicate(
    "round-trip clinical → rig → clinical",
    nclose(
      toClinicalAngle(toRigAngle(37, frame.abduction), frame.abduction)!,
      37,
    ),
  );
  TestValidator.equals(
    "a null angle passes through",
    toRigAngle(null, frame.abduction),
    null,
  );
  TestValidator.equals(
    "no frame is the identity (rig)",
    toRigAngle(150, undefined),
    150,
  );
  TestValidator.equals(
    "no frame is the identity (clinical)",
    toClinicalAngle(150, undefined),
    150,
  );
  TestValidator.equals(
    "a null angle passes through (clinical)",
    toClinicalAngle(null, frame.abduction),
    null,
  );

  // 2. clinical-with-frame == pre-converted rig-without-frame
  const qClinical = jointToQuaternion(
    { flexion: null, abduction: 150, twist: null },
    DEFAULT_JOINT_AXES,
    frame,
  );
  const qRig = jointToQuaternion(
    { flexion: null, abduction: -60, twist: null },
    DEFAULT_JOINT_AXES,
  );
  TestValidator.predicate(
    "jointToQuaternion(clinical, frame) == jointToQuaternion(rig)",
    qclose(qClinical, qRig),
  );

  // 3. decompose round-trips the clinical angles through the frame
  const c = { flexion: 20, abduction: 150, twist: 10 };
  const q = jointToQuaternion(c, DEFAULT_JOINT_AXES, frame);
  const back = decomposeJointRotation(q, DEFAULT_JOINT_AXES, frame);
  TestValidator.predicate(
    "decompose lifts back to the clinical angles",
    nclose(back.flexion, 20, 1e-6) &&
      nclose(back.abduction, 150, 1e-6) &&
      nclose(back.twist, 10, 1e-6),
  );
  TestValidator.predicate(
    "and re-composing them reproduces the rotation",
    qclose(jointToQuaternion(back, DEFAULT_JOINT_AXES, frame), q),
  );

  // gimbal: clinical 0 maps to rig abduction +90 (the arm straight along the
  // frame axis) — decompose pins flexion and lifts abduction back to 0.
  const gimbal = jointToQuaternion(
    { flexion: 30, abduction: 0, twist: 0 },
    DEFAULT_JOINT_AXES,
    frame,
  );
  const gBack = decomposeJointRotation(gimbal, DEFAULT_JOINT_AXES, frame);
  TestValidator.predicate(
    "the gimbal case lifts abduction back to clinical 0",
    nclose(gBack.abduction, 0, 1e-6),
  );
  TestValidator.predicate(
    "and the gimbal rotation round-trips",
    qclose(jointToQuaternion(gBack, DEFAULT_JOINT_AXES, frame), gimbal),
  );
};
