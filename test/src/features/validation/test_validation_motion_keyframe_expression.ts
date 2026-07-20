import { validateMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  joint,
  keyframe,
  makeExpression,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const rest = makePose([joint("leftLowerArm", { flexion: 0 })]);

/**
 * Motion validation also validates each keyframe's optional expression (range
 * checks on weights/intensity), reporting under that keyframe's expression
 * path. Pins the keyframe-expression branch (and the path/collector-passing
 * arm of `validateExpression`) that the bare pose clips never exercise.
 *
 * Scenario: a 1s clip whose second keyframe carries an expression with an
 * out-of-range blendshape weight (1.5). The clip's poses are all valid, so the
 * only failure must be the `range` violation surfaced under
 * `keyframes[1].expression`.
 */
export const test_validation_motion_keyframe_expression = (): void => {
  const motion = makeMotion(
    [
      keyframe(0, rest, "linear", makeExpression("happy", 0.5)),
      keyframe(
        1,
        rest,
        "linear",
        makeExpression("happy", 0.5, [{ channel: "jawOpen", weight: 1.5 }]),
      ),
    ],
    1,
  );
  const result = validateMotion({ motion, skeleton: createSkeleton() });
  TestValidator.equals("bad keyframe expression fails", result.success, false);
  TestValidator.predicate(
    "range violation under a keyframe expression",
    hasViolation(result, "range", "keyframes[1].expression"),
  );
};
