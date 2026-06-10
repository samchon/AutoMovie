import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Face weights are signed, so the range check must fire on the negative side
 * too — shrinking past the limit is as illegal as growing past it.
 *
 * Scenario: `jawWidth` at weight -2.1 fails, with a `range` violation on the
 * weight.
 */
export const test_validation_face_weight_negative = (): void => {
  const result = validateFaceResult(
    makeFace([{ parameter: "jawWidth", weight: -2.1 }]),
  );
  TestValidator.equals("below-range weight fails", result.success, false);
  TestValidator.predicate(
    "range violation on weight",
    hasViolation(result, "range", ".weight"),
  );
};
