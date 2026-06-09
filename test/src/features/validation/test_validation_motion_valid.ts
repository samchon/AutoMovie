import { validateMotion } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidMotion } from "../internal/fixtures";

/**
 * A well-formed clip validates: keyframe times strictly increase within the
 * duration, and every keyframe pose is inside ROM. The "valid clip passes"
 * baseline above the temporal and per-keyframe failure cases.
 *
 * Scenario: the standard two-keyframe elbow clip (0°→120° over 1s) succeeds.
 */
export const test_validation_motion_valid = (): void => {
  const result = validateMotion({
    motion: createValidMotion(),
    skeleton: createSkeleton(),
  });
  TestValidator.equals("valid motion succeeds", result.success, true);
};
