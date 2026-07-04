import { validateExpressionResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeExpression } from "../internal/fixtures";

/**
 * An expression with an in-range preset intensity and in-range blendshape
 * weights validates ??the "valid face passes" baseline for expression
 * checking.
 *
 * Scenario: the `happy` preset at intensity 0.8 with a `jawOpen` channel at 0.3
 * (all within [0,1]) succeeds.
 */
export const test_validation_expression_valid = (): void => {
  const result = validateExpressionResult(
    makeExpression("happy", 0.8, [{ channel: "jawOpen", weight: 0.3 }]),
  );
  TestValidator.equals("valid expression succeeds", result.success, true);
};
