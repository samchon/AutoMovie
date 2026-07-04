import { validatePoseResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidPose } from "../internal/fixtures";

/**
 * A pose whose every articulated joint sits inside its anatomical range
 * validates successfully ??the "valid input passes" baseline that gives the
 * failure tests their meaning.
 *
 * Scenario: the standard valid pose (shoulder, elbow, and hip all well within
 * their ROM) against the test skeleton succeeds.
 */
export const test_validation_pose_valid = (): void => {
  const result = validatePoseResult(createValidPose(), createSkeleton());
  TestValidator.equals("valid pose succeeds", result.success, true);
};
