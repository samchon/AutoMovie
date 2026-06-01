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
 * Every keyframe must fall within the clip's declared duration; a keyframe
 * timed past the end is a `temporal` violation. Pins that duration and keyframe
 * times stay consistent.
 *
 * Scenario: a 1s clip with a keyframe at t=2 fails, with a `temporal` violation
 * on the time.
 */
export const test_validation_motion_time_duration = (): void => {
  const motion = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(2, makePose([joint("leftLowerArm", { flexion: 30 })])),
    ],
    1,
  );
  const result = validateMotion({ motion, skeleton: createSkeleton() });
  TestValidator.equals("time past duration fails", result.success, false);
  TestValidator.predicate(
    "temporal violation on time",
    hasViolation(result, "temporal", ".time"),
  );
};
