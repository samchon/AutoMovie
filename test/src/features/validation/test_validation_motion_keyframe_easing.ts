import { validateMotion } from "@automovie/engine";
import { AutoMovieEasing } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidMotion } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Keyframe easing names are closed in the interface, but JSON payloads can
 * still carry forged strings. Motion validation must reject unknown easing
 * names before sampling reaches the easing evaluator.
 *
 * Scenario: an otherwise valid two-keyframe clip uses an unknown `bounce`
 * easing on the first keyframe. Validation fails with a `type` violation on the
 * keyframe easing field.
 */
export const test_validation_motion_keyframe_easing = (): void => {
  const base = createValidMotion();
  const motion = {
    ...base,
    keyframes: base.keyframes.map((kf, i) =>
      i === 0 ? { ...kf, easing: "bounce" as AutoMovieEasing } : kf,
    ),
  };

  const result = validateMotion({ motion, skeleton: createSkeleton() });
  TestValidator.equals("unknown easing fails", result.success, false);
  TestValidator.predicate(
    "easing type violation",
    hasViolation(result, "type", ".easing"),
  );
};
