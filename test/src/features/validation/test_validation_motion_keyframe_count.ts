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
 * A motion clip needs at least two keyframes: a start and an end for the
 * sampling/export interpolation contract.
 *
 * Scenarios:
 *
 * 1. An empty keyframe list is a temporal validation failure.
 * 2. A single keyframe is also a temporal validation failure.
 */
export const test_validation_motion_keyframe_count = (): void => {
  const skeleton = createSkeleton();
  const empty = validateMotion({
    motion: makeMotion([], 1),
    skeleton,
  });
  TestValidator.equals("empty keyframes fail", empty.success, false);
  TestValidator.predicate(
    "empty keyframes report temporal keyframes violation",
    hasViolation(empty, "temporal", "$input.keyframes"),
  );

  const single = validateMotion({
    motion: makeMotion(
      [keyframe(0, makePose([joint("leftLowerArm", { flexion: 30 })]))],
      1,
    ),
    skeleton,
  });
  TestValidator.equals("single keyframe fails", single.success, false);
  TestValidator.predicate(
    "single keyframe reports temporal keyframes violation",
    hasViolation(single, "temporal", "$input.keyframes"),
  );
};
