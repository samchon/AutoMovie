import { validateMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Per-keyframe ROM is not enough ??two individually valid poses can still imply
 * an impossibly fast motion between them. The temporal verifier flags a shared
 * joint that swings faster than the engine's bound, catching teleporting limbs
 * that frame-by-frame validation would miss.
 *
 * Scenario: a shoulder swinging 0째??70째 in 0.1s (1700째/s, over the bound)
 * fails, with a `temporal` violation on the pose ??even though 0째 and 170째 are
 * each within the shoulder's ROM.
 */
export const test_validation_motion_angular_speed = (): void => {
  const motion = makeMotion(
    [
      keyframe(0, makePose([joint("leftUpperArm", { flexion: 0 })])),
      keyframe(0.1, makePose([joint("leftUpperArm", { flexion: 170 })])),
    ],
    0.1,
  );
  const result = validateMotion({ motion, skeleton: createSkeleton() });
  TestValidator.equals("teleporting limb fails", result.success, false);
  TestValidator.predicate(
    "temporal violation on pose",
    hasViolation(result, "temporal", ".pose"),
  );
};
