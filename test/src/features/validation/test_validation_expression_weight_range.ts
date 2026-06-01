import { validateExpressionResult } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { makeExpression } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Blendshape weights are kept as rough plain numbers, so their [0,1] bound is
 * enforced at runtime by the engine rather than by the type. A weight outside
 * the range is a `range` violation.
 *
 * Scenario: a `jawOpen` channel at weight 1.5 fails, with a `range` violation
 * on the weight.
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
