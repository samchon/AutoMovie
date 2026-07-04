import { validateExpressionResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeExpression } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Preset intensity, like blendshape weights, is a rough plain number whose
 * [0,1] bound the engine enforces at runtime. An out-of-range intensity is a
 * `range` violation.
 *
 * Scenario: the `happy` preset at intensity 2 fails, with a `range` violation
 * on the intensity.
 */
export const test_validation_expression_intensity_range = (): void => {
  const result = validateExpressionResult(makeExpression("happy", 2));
  TestValidator.equals("out-of-range intensity fails", result.success, false);
  TestValidator.predicate(
    "range violation on intensity",
    hasViolation(result, "range", ".intensity"),
  );
};
