import { validatePoseResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A pose may only articulate bones the target skeleton actually has; citing a
 * missing bone is a dangling reference, reported as a `type` violation. Pins
 * that a pose authored against the wrong rig is caught rather than silently
 * ignored.
 *
 * Scenario: a pose articulating `jaw` — a bone the test skeleton lacks — fails,
 * with a `type` violation on the bone.
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
