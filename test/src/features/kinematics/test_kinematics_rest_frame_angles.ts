import {
  DEFAULT_JOINT_AXES,
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  IAutoMovieRestFrame,
  decomposeJointRotation,
  jointToQuaternion,
  reachPose,
  resolvePose,
  toClinicalAngle,
  toRigAngle,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { nclose, qclose, vclose } from "../internal/predicates";

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
  const frame: IAutoMovieRestFrame = { abduction: { sign: -1, neutral: 90 } };

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

  // 4. resolvePose threads the frame: a clinical pose resolved with the humanoid
  // rest frames matches the pre-converted rig pose resolved without them. The
  // left arm's frame is sign +1, neutral 90, so clinical 120 → rig 30.
  const skel = createSkeleton();
  const handClinical = resolvePose(
    makePose([joint("leftUpperArm", { abduction: 120 })]),
    skel,
    HUMANOID_JOINT_AXES,
    HUMANOID_REST_FRAME,
  ).find((b) => b.bone === "leftHand")!.worldPosition;
  const handRig = resolvePose(
    makePose([joint("leftUpperArm", { abduction: 30 })]),
    skel,
    HUMANOID_JOINT_AXES,
  ).find((b) => b.bone === "leftHand")!.worldPosition;
  TestValidator.predicate(
    "resolvePose(clinical, frames) == resolvePose(pre-converted rig)",
    vclose(handClinical, handRig, 1e-9),
  );

  // 5. reachPose threads the frame: its output arm angles come out clinical
  // (lifted by sign·r + neutral); left arm sign +1, neutral 90 → clinical =
  // rig + 90.
  const target = { x: 0.45, y: 1.3, z: 0.3 };
  const reachClinical = reachPose(skel, "left", target, HUMANOID_REST_FRAME);
  const reachRig = reachPose(skel, "left", target);
  TestValidator.predicate(
    "reachPose returns a pose both ways",
    reachClinical !== null && reachRig !== null,
  );
  if (reachClinical !== null && reachRig !== null) {
    const cAbd = reachClinical.joints.find(
      (j) => j.bone === "leftUpperArm",
    )!.abduction!;
    const rAbd = reachRig.joints.find(
      (j) => j.bone === "leftUpperArm",
    )!.abduction!;
    TestValidator.predicate(
      "the reach's upper-arm abduction is lifted to clinical (rig + 90)",
      nclose(cAbd, rAbd + 90, 1e-6),
    );
  }
};
