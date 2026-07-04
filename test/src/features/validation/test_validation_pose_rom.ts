import { validatePoseResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pose validation runs the ROM verifier over every joint, so an anatomically
 * impossible pose is rejected ??the engine's core differentiator surfacing at
 * the whole-pose level, not just the bare-joint level.
 *
 * Scenario: an elbow bent to 175째 flexion (past its 150째 limit) fails, with a
 * `rom` violation on the flexion axis.
 */
export const test_validation_pose_rom = (): void => {
  const result = validatePoseResult(
    makePose([joint("leftLowerArm", { flexion: 175 })]),
    createSkeleton(),
  );
  TestValidator.equals("impossible pose fails", result.success, false);
  TestValidator.predicate(
    "rom violation on flexion",
    hasViolation(result, "rom", ".flexion"),
  );
};
