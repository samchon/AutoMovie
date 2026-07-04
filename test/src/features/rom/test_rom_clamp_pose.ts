import { clampJointRom, clampPose } from "@automovie/engine";
import {
  IAutoMovieBone,
  IAutoMovieJointConstraint,
  IAutoMoviePose,
  IAutoMovieSkeleton,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const REST = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};
const bone = (
  name: IAutoMovieBone["bone"],
  constraint: IAutoMovieJointConstraint | null,
): IAutoMovieBone => ({ bone: name, parent: null, rest: REST, constraint });

// leftLowerArm carries an explicit override; leftUpperArm falls back to the
// default table; hips has no constraint anywhere (pass-through).
const SKELETON: IAutoMovieSkeleton = {
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
 * 5. Non-finite constrained-axis values are neutralized before range clamping, so
 *    the clamp output remains finite.
 */
export const test_rom_clamp_pose = (): void => {
  const pose: IAutoMoviePose = {
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

  // 5. non-finite constrained axes are sanitized before clamping
  const sanitizedJoint = clampJointRom(
    {
      bone: "leftLowerArm",
      flexion: Number.NaN,
      abduction: null,
      twist: null,
    },
    SKELETON.bones[0]!.constraint!,
  );
  TestValidator.equals(
    "NaN flexion neutralizes to rest",
    sanitizedJoint.flexion,
    0,
  );

  const sanitizedPose = clampPose(
    {
      skeleton: "s",
      root: REST,
      joints: [
        {
          bone: "leftUpperArm",
          flexion: Number.NaN,
          abduction: Number.POSITIVE_INFINITY,
          twist: 0,
        },
      ],
    },
    SKELETON,
  );
  const sanitizedArm = sanitizedPose.joints[0]!;
  TestValidator.equals(
    "pose NaN flexion neutralizes to rest",
    sanitizedArm.flexion,
    0,
  );
  TestValidator.equals(
    "pose infinite abduction neutralizes to rest",
    sanitizedArm.abduction,
    0,
  );
  TestValidator.predicate(
    "pose clamp output axes are finite",
    Number.isFinite(sanitizedArm.flexion) &&
      Number.isFinite(sanitizedArm.abduction) &&
      Number.isFinite(sanitizedArm.twist),
  );
};
