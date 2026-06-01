import { validateExpressionResult } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { makeExpression } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/** Setting the same ARKit channel twice is a `type` violation on the channel. */
export const test_validation_expression_duplicate_channel = (): void => {
  const result = validateExpressionResult(
    makeExpression("neutral", 0.5, [
      { channel: "jawOpen", weight: 0.3 },
      { channel: "jawOpen", weight: 0.6 },
    ]),
  );
  TestValidator.equals("duplicate channel fails", result.success, false);
  TestValidator.predicate(
    "type violation on channel",
    hasViolation(result, "type", ".channel"),
  );
};
