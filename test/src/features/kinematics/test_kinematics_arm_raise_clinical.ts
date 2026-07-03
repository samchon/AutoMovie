import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  resolvePose,
} from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmBone,
  IAutoFilmPose,
  IAutoFilmSkeleton,
} from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * The **clinical arm-raise semantics** the rest-frame decode must deliver on a
 * real rig — the ground truth the `celebrate`/`wave`/reach flip depends on, and
 * the calibration that mislabelled its own signs twice before being measured.
 *
 * The stickman arm rests in a T-pose: the upper arm carries an **identity** rest
 * rotation and points down its parent's +x (a horizontal arm), the forearm and
 * hand continue along +x. Under that geometry the humanoid abduction axis swings
 * the +x arm through the vertical plane, so rig `+90` lifts the **left** hand
 * overhead while rig `−90` drops it — and the mirror holds on the right. The
 * whole point of {@link HUMANOID_REST_FRAME} (left `sign +1 neutral 90`, right
 * `sign −1 neutral 90`) is to erase that per-side sign: in **clinical** space a
 * single `abduction 180` raises _either_ arm overhead, `0` lets it hang.
 *
 * Scenarios:
 *
 * 1. At rest each hand sits at shoulder height (the arm is horizontal).
 * 2. Read as clinical through the rest frames, `abduction 180` lifts **both**
 *    hands above the shoulders with the _same_ value (no left/right mirror), and
 *    `abduction 0` drops both below — the semantic the flip promises.
 * 3. A clinical pose resolved with the frames equals the pre-converted rig pose
 *    resolved without them (left clinical 180 ≡ rig 90; right clinical 180 ≡ rig
 *    −90), tying the semantics back to the raw rig articulation.
 */
export const test_kinematics_arm_raise_clinical = (): void => {
  // A minimal T-pose-arm rig matching the stickman's arm geometry: identity rest
  // rotations, the shoulder raised off the chest, each arm reaching out along ±x.
  const bone = (
    b: string,
    parent: string | null,
    t: [number, number, number],
  ): IAutoFilmBone => ({
    bone: b as AutoFilmHumanoidBone,
    parent: parent as AutoFilmHumanoidBone | null,
    rest: {
      translation: { x: t[0], y: t[1], z: t[2] },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    constraint: null,
  });
  const skeleton: IAutoFilmSkeleton = {
    id: "tpose-arms",
    bones: [
      bone("hips", null, [0, 0.92, 0]),
      bone("spine", "hips", [0, 0.2, 0]),
      bone("chest", "spine", [0, 0.22, 0]),
      bone("leftUpperArm", "chest", [0.17, 0.14, 0]),
      bone("leftLowerArm", "leftUpperArm", [0.29, 0, 0]),
      bone("leftHand", "leftLowerArm", [0.26, 0, 0]),
      bone("rightUpperArm", "chest", [-0.17, 0.14, 0]),
      bone("rightLowerArm", "rightUpperArm", [-0.29, 0, 0]),
      bone("rightHand", "rightLowerArm", [-0.26, 0, 0]),
    ],
  };

  const pose = (joints: IAutoFilmPose["joints"]): IAutoFilmPose => ({
    skeleton: skeleton.id,
    root: null,
    joints,
  });
  const arm = (
    bone: "leftUpperArm" | "rightUpperArm",
    abduction: number,
  ): IAutoFilmPose["joints"][number] => ({
    bone,
    flexion: null,
    abduction,
    twist: null,
  });
  const yOf = (
    p: IAutoFilmPose,
    b: AutoFilmHumanoidBone,
    frames = false,
  ): number =>
    resolvePose(
      p,
      skeleton,
      HUMANOID_JOINT_AXES,
      frames ? HUMANOID_REST_FRAME : undefined,
    ).find((r) => r.bone === b)!.worldPosition.y;

  const shoulderL = yOf(pose([]), "leftUpperArm");
  const shoulderR = yOf(pose([]), "rightUpperArm");

  // 1. at rest the hands hang level with the shoulders (a horizontal T-pose arm)
  TestValidator.predicate(
    "at rest each hand sits at shoulder height",
    nclose(yOf(pose([]), "leftHand"), shoulderL, 1e-9) &&
      nclose(yOf(pose([]), "rightHand"), shoulderR, 1e-9),
  );

  // 2. clinical abduction 180 raises BOTH arms overhead with the same value; 0
  //    drops both — the no-mirror semantic the flip delivers.
  const up = pose([arm("leftUpperArm", 180), arm("rightUpperArm", 180)]);
  TestValidator.predicate(
    "clinical abduction 180 lifts both hands overhead (same value, no mirror)",
    yOf(up, "leftHand", true) > shoulderL + 0.3 &&
      yOf(up, "rightHand", true) > shoulderR + 0.3,
  );
  const down = pose([arm("leftUpperArm", 0), arm("rightUpperArm", 0)]);
  TestValidator.predicate(
    "clinical abduction 0 lets both hands hang below the shoulders",
    yOf(down, "leftHand", true) < shoulderL - 0.3 &&
      yOf(down, "rightHand", true) < shoulderR - 0.3,
  );

  // 3. the clinical read equals the pre-converted rig pose (left 180 ≡ rig 90,
  //    right 180 ≡ rig −90) — the rest frame is exactly that per-side remap.
  TestValidator.predicate(
    "left clinical 180 resolves to the same height as raw rig 90",
    nclose(
      yOf(pose([arm("leftUpperArm", 180)]), "leftHand", true),
      yOf(pose([arm("leftUpperArm", 90)]), "leftHand"),
      1e-9,
    ),
  );
  TestValidator.predicate(
    "right clinical 180 resolves to the same height as raw rig −90",
    nclose(
      yOf(pose([arm("rightUpperArm", 180)]), "rightHand", true),
      yOf(pose([arm("rightUpperArm", -90)]), "rightHand"),
      1e-9,
    ),
  );
};
