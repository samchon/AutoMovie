import { validateExpressionResult } from "@automovie/engine";
import { AutoMovieExpressionPreset } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeExpression } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Expression presets are closed names in the interface, but JSON payloads can
 * still carry forged strings. Validation must reject unknown presets before a
 * runtime applies or samples the expression.
 *
 * Scenario: an expression carries an unknown `confused` preset with an in-range
 * intensity. Validation fails with a `type` violation on `preset`.
 */
export const test_validation_expression_preset_name = (): void => {
  const result = validateExpressionResult(
    makeExpression("confused" as AutoMovieExpressionPreset, 0.5),
  );

  TestValidator.equals("unknown preset fails", result.success, false);
  TestValidator.predicate(
    "preset type violation",
    hasViolation(result, "type", ".preset"),
  );
};
