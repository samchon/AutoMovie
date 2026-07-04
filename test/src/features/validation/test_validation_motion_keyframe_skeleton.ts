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
 * Motion keyframes inherit the same pose skeleton-id contract under their
 * keyframe path.
 *
 * Scenario: the first keyframe pose is relabeled to another skeleton id while
 * the motion itself targets `skeleton-1`; validation fails under that keyframe
 * pose.
 */
export const test_validation_motion_keyframe_skeleton = (): void => {
  const skeleton = createSkeleton();
  const result = validateMotion({
    motion: makeMotion(
      [
        keyframe(0, {
          ...makePose([joint("leftLowerArm", { flexion: 0 })]),
          skeleton: "skeleton-2",
        }),
        keyframe(1, makePose([joint("leftLowerArm", { flexion: 30 })])),
      ],
      1,
    ),
    skeleton,
  });
  TestValidator.equals(
    "mismatched keyframe pose skeleton fails",
    result.success,
    false,
  );
  TestValidator.predicate(
    "type violation on keyframe pose skeleton",
    hasViolation(result, "type", "$input.keyframes[0].pose.skeleton"),
  );
};
