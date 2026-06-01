import { validateMotion } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidMotion } from "../internal/fixtures";

/**
 * A well-formed clip (increasing keyframe times within duration, every keyframe
 * pose inside ROM) validates successfully.
 */
export const test_validation_motion_valid = (): void => {
  const result = validateMotion({
    motion: createValidMotion(),
    skeleton: createSkeleton(),
  });
  TestValidator.equals("valid motion succeeds", result.success, true);
};
