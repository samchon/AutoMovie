import { clampPose } from "@autofilm/engine";
import {
  IAutoFilmBone,
  IAutoFilmJointConstraint,
  IAutoFilmPose,
  IAutoFilmSkeleton,
} from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

const REST = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};
const bone = (
  name: IAutoFilmBone["bone"],
  constraint: IAutoFilmJointConstraint | null,
): IAutoFilmBone => ({ bone: name, parent: null, rest: REST, constraint });

// leftLowerArm carries an explicit override; leftUpperArm falls back to the
// default table; hips has no constraint anywhere (pass-through).
const SKELETON: IAutoFilmSkeleton = {
  id: "s",
  bones: [
    bone("leftLowerArm", {
      flexion: { min: 0, max: 90 },
      abduction: null,
      twist: null,
    }),
    bone("leftUpperArm", null),
    bone("hips", null),
  ],
};

/**
 * `clampPose` — the enforce face of ROM. Every joint axis is pulled into its
 * `[min,max]`; an immobile (`null`) axis is forced to 0; an unconstrained bone
 * passes through. Mirrors `validateJointRom`'s bounds, so a clamped pose is one
 * that pose-ROM validation would accept.
 *
 * Scenarios:
 *
 * 1. Per-bone override: leftLowerArm flexion 120 → 90 (above max), its `null`
 *    abduction 30 → 0 (immobile axis), its `null`-angle twist stays `null`.
 * 2. Default-table fallback: leftUpperArm flexion −200 → −60 (below min), and its
 *    in-range abduction 50 is left untouched.
 * 3. Bone not in the skeleton resolves to the default table (rightLowerArm flexion
 *    200 → 150).
 * 4. A bone with no constraint anywhere (hips) passes through unchanged, and the
 *    root transform is preserved.
 */
export const test_rom_clamp_pose = (): void => {
  const pose: IAutoFilmPose = {
    skeleton: "s",
    root: REST,
    joints: [
      { bone: "leftLowerArm", flexion: 120, abduction: 30, twist: null },
      { bone: "leftUpperArm", flexion: -200, abduction: 50, twist: 0 },
      { bone: "rightLowerArm", flexion: 200, abduction: null, twist: null },
      { bone: "hips", flexion: 999, abduction: null, twist: null },
    ],
  };
  const out = clampPose(pose, SKELETON);
  const byBone = (b: string) => out.joints.find((j) => j.bone === b)!;

  // 1. override
  TestValidator.equals(
    "flexion clamped to override max",
    byBone("leftLowerArm").flexion,
    90,
  );
  TestValidator.equals(
    "immobile abduction → 0",
    byBone("leftLowerArm").abduction,
    0,
  );
  TestValidator.equals(
    "null twist stays null",
    byBone("leftLowerArm").twist,
    null,
  );

  // 2. default-table fallback
  TestValidator.equals(
    "flexion clamped to table min",
    byBone("leftUpperArm").flexion,
    -60,
  );
  TestValidator.equals(
    "in-range abduction untouched",
    byBone("leftUpperArm").abduction,
    50,
  );

  // 3. bone absent from the skeleton → default table
  TestValidator.equals(
    "absent bone uses table",
    byBone("rightLowerArm").flexion,
    150,
  );

  // 4. unconstrained bone passes through; root preserved
  TestValidator.equals(
    "unconstrained passes through",
    byBone("hips").flexion,
    999,
  );
  TestValidator.equals("root preserved", out.root, REST);
};
