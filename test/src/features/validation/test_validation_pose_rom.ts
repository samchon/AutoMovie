import { validatePoseResult } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A pose that bends the elbow past its anatomical limit fails with a `rom`
 * violation on the flexion axis — the engine's core differentiator surfacing
 * through pose validation.
 */
export const test_validation_pose_rom = (): void => {
  const result = validatePoseResult(
    makePose([joint("leftLowerArm", { flexion: 175 })]),
    createSkeleton(),
  );
  TestValidator.equals("impossible pose fails", result.success, false);
  TestValidator.predicate(
    "rom violation on flexion",
    hasViolation(result, "rom", ".flexion"),
  );
};
