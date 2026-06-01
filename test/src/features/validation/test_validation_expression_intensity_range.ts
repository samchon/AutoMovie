import { validateExpressionResult } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { makeExpression } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/** Preset intensity outside [0,1] is a `range` violation. */
export const test_validation_expression_intensity_range = (): void => {
  const result = validateExpressionResult(makeExpression("happy", 2));
  TestValidator.equals("out-of-range intensity fails", result.success, false);
  TestValidator.predicate(
    "range violation on intensity",
    hasViolation(result, "range", ".intensity"),
  );
};
