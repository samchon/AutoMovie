import { validatePoseResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Articulating the same bone twice in one pose is a conflict — two competing
 * rotations for one joint — reported as a `type` violation so the ambiguity is
 * surfaced rather than resolved arbitrarily.
 *
 * Scenario: a pose listing `leftLowerArm` twice (30° and 60°) fails, with a
 * `type` violation on the bone.
 */
export const test_validation_pose_duplicate_bone = (): void => {
  const result = validatePoseResult(
    makePose([
      joint("leftLowerArm", { flexion: 30 }),
      joint("leftLowerArm", { flexion: 60 }),
    ]),
    createSkeleton(),
  );
  TestValidator.equals("duplicate bone fails", result.success, false);
  TestValidator.predicate(
    "type violation on bone",
    hasViolation(result, "type", ".bone"),
  );
};
