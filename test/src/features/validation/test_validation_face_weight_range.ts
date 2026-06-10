import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Weights are rough plain numbers, so the [-2, 2] bound is enforced at runtime
 * by the engine rather than by the type. A weight just past the positive limit
 * is a `range` violation — the negative twin of the valid case's `+2`.
 *
 * Scenario: `eyeSize` at weight 2.1 fails, with a `range` violation on the
 * weight.
 */
export const test_validation_face_weight_range = (): void => {
  const result = validateFaceResult(
    makeFace([{ parameter: "eyeSize", weight: 2.1 }]),
  );
  TestValidator.equals("out-of-range weight fails", result.success, false);
  TestValidator.predicate(
    "range violation on weight",
    hasViolation(result, "range", ".weight"),
  );
};
