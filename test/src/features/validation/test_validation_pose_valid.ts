import { validatePoseResult } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidPose } from "../internal/fixtures";

/** A pose whose every joint sits inside its ROM validates successfully. */
export const test_validation_pose_valid = (): void => {
  const result = validatePoseResult(createValidPose(), createSkeleton());
  TestValidator.equals("valid pose succeeds", result.success, true);
};
