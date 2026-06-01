import { validateMotion } from "@motica/engine";
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
 * Two adjacent keyframes whose shared joint swings too fast (here 170° in 0.1s
 * = 1700°/s, over the engine's bound) are a `temporal` violation — caught even
 * though both poses are individually within ROM.
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
