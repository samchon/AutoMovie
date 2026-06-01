import { validateExpressionResult } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { makeExpression } from "../internal/fixtures";

/** A preset with in-range intensity and in-range blendshape weights validates. */
export const test_validation_expression_valid = (): void => {
  const result = validateExpressionResult(
    makeExpression("happy", 0.8, [{ channel: "jawOpen", weight: 0.3 }]),
  );
  TestValidator.equals("valid expression succeeds", result.success, true);
};
