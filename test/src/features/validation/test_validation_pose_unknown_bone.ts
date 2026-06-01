import { validatePoseResult } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A pose that articulates a bone the target skeleton does not have fails with a
 * `type` violation (the test skeleton has no `jaw`).
 */
export const test_validation_pose_unknown_bone = (): void => {
  const result = validatePoseResult(
    makePose([joint("jaw", { flexion: 10 })]),
    createSkeleton(),
  );
  TestValidator.equals("unknown bone fails", result.success, false);
  TestValidator.predicate(
    "type violation on bone",
    hasViolation(result, "type", ".bone"),
  );
};
