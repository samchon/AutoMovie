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
 * Keyframe times must strictly increase, so a clip is an unambiguous timeline;
 * a non-increasing time is a `temporal` violation. Pins that the sampler's
 * "strictly increasing" precondition is enforced at the validation gate.
 *
 * Scenario: a clip with keyframes at 0, 0.5, and again 0.5 fails, with a
 * `temporal` violation on the time.
 */
export const test_validation_motion_time_order = (): void => {
  const motion = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(0.5, makePose([joint("leftLowerArm", { flexion: 30 })])),
      keyframe(0.5, makePose([joint("leftLowerArm", { flexion: 60 })])),
    ],
    1,
  );
  const result = validateMotion({ motion, skeleton: createSkeleton() });
  TestValidator.equals("non-increasing time fails", result.success, false);
  TestValidator.predicate(
    "temporal violation on time",
    hasViolation(result, "temporal", ".time"),
  );
};
