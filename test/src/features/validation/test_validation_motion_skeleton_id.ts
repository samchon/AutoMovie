import { validateMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidMotion } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A motion clip's declared skeleton id must match the rig it is validated
 * against, independently of each keyframe pose id.
 *
 * Scenario: a valid clip relabeled to another skeleton id fails with a `type`
 * violation on the motion skeleton field.
 */
export const test_validation_motion_skeleton_id = (): void => {
  const result = validateMotion({
    motion: { ...createValidMotion(), skeleton: "skeleton-2" },
    skeleton: createSkeleton(),
  });
  TestValidator.equals(
    "mismatched motion skeleton fails",
    result.success,
    false,
  );
  TestValidator.predicate(
    "type violation on motion skeleton",
    hasViolation(result, "type", "$input.skeleton"),
  );
};
