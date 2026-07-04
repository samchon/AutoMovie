import { validatePoseResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidPose } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A pose's declared skeleton id must match the rig it is validated against.
 *
 * Scenario: a valid anatomical pose relabeled to another skeleton id fails with
 * a `type` violation on the pose skeleton field.
 */
export const test_validation_pose_skeleton_id = (): void => {
  const result = validatePoseResult(
    { ...createValidPose(), skeleton: "skeleton-2" },
    createSkeleton(),
  );
  TestValidator.equals("mismatched pose skeleton fails", result.success, false);
  TestValidator.predicate(
    "type violation on pose skeleton",
    hasViolation(result, "type", "$input.skeleton"),
  );
};
