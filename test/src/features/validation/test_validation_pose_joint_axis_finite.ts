import { validatePoseResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Joint axes are LLM-facing numeric degrees. A non-null axis must be finite
 * before ROM bounds or swing-cone math can safely run.
 *
 * Scenarios:
 *
 * 1. NaN flexion on an otherwise ROM-constrained elbow is rejected.
 * 2. The violation points at the exact joint axis field.
 */
export const test_validation_pose_joint_axis_finite = (): void => {
  const result = validatePoseResult(
    makePose([joint("leftLowerArm", { flexion: Number.NaN })]),
    createSkeleton(),
  );

  TestValidator.equals("non-finite joint axis fails", result.success, false);
  TestValidator.predicate(
    "range violation on joint axis",
    hasViolation(result, "range", "$input.joints[0].flexion"),
  );
};
