import { validatePoseResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";

/**
 * A per-bone constraint on the skeleton overrides the default ROM table, so a
 * stylized or non-human rig can permit motion the anatomical defaults forbid.
 * Pins that the override path actually loosens validation, not just the table
 * lookup.
 *
 * Scenario: with the elbow's constraint widened to flexion [0, 200], a 175°
 * flexion — rejected by the default 150° limit — validates successfully.
 */
export const test_validation_pose_override = (): void => {
  const base = createSkeleton();
  const skeleton = {
    ...base,
    bones: base.bones.map((b) =>
      b.bone === "leftLowerArm"
        ? {
            ...b,
            constraint: {
              flexion: { min: 0, max: 200 },
              abduction: null,
              twist: null,
            },
          }
        : b,
    ),
  };
  const result = validatePoseResult(
    makePose([joint("leftLowerArm", { flexion: 175 })]),
    skeleton,
  );
  TestValidator.equals("override widens ROM → valid", result.success, true);
};
