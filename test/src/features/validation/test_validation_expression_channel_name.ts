import { validateExpressionResult } from "@automovie/engine";
import { AutoMovieArkitChannel } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeExpression } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * ARKit blendshape channel names are closed in the interface, but JSON payloads
 * can still carry forged strings. Validation must reject unknown channels
 * before a runtime applies or samples the expression.
 *
 * Scenario: an expression carries an unknown `jawWide` channel with an in-range
 * weight. Validation fails with a `type` violation on the channel.
 */
export const test_validation_expression_channel_name = (): void => {
  const result = validateExpressionResult(
    makeExpression("neutral", 0.5, [
      { channel: "jawWide" as AutoMovieArkitChannel, weight: 0.5 },
    ]),
  );

  TestValidator.equals("unknown channel fails", result.success, false);
  TestValidator.predicate(
    "channel type violation",
    hasViolation(result, "type", ".channel"),
  );
};
