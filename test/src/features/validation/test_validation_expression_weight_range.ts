import { validateExpressionResult } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { makeExpression } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A blendshape weight outside [0,1] is a `range` violation — the runtime check
 * the rough numeric type intentionally does not encode.
 */
export const test_validation_expression_weight_range = (): void => {
  const result = validateExpressionResult(
    makeExpression("neutral", 0.5, [{ channel: "jawOpen", weight: 1.5 }]),
  );
  TestValidator.equals("out-of-range weight fails", result.success, false);
  TestValidator.predicate(
    "range violation on weight",
    hasViolation(result, "range", ".weight"),
  );
};
