import {
  humanFaceExpressionDefinitions,
  resolveHumanFaceExpression,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Expression omission means neutral independently on each anatomical side.
 *
 * Scenarios:
 * 1. All channels expand to zero and one-sided edits never copy across the face.
 * 2. Both supported endpoints are admitted, with adjacent out-of-range and nonfinite twins refused.
 * 3. Unknown channels/sides and scalar-versus-paired shape errors refuse rather than becoming inactive settings.
 */
export const test_subject_human_expression = (): void => {
  const neutral = resolveHumanFaceExpression();
  for (const definition of humanFaceExpressionDefinitions) {
    TestValidator.equals(
      "explicit neutral",
      neutral[definition.id],
      definition.paired ? { right: 0, left: 0 } : 0,
    );
    for (const number of [definition.minimum, definition.maximum]) {
      const value = definition.paired
        ? { right: number, left: number }
        : number;
      TestValidator.equals(
        "endpoint",
        resolveHumanFaceExpression({ [definition.id]: value })[definition.id],
        value,
      );
    }
    for (const number of [
      definition.minimum - 0.001,
      definition.maximum + 0.001,
      NaN,
      Infinity,
    ])
      TestValidator.predicate(
        "adjacent range refusal",
        throwsError(() =>
          resolveHumanFaceExpression({
            [definition.id]: definition.paired ? { right: number } : number,
          }),
        ),
      );
  }
  const input = { blink: { left: 0.5 }, smile: { right: 2 }, jawOpen: 3 };
  const result = resolveHumanFaceExpression(input);
  input.blink.left = 1;
  TestValidator.equals("independent owned blink", result.blink, {
    right: 0,
    left: 0.5,
  });
  TestValidator.equals("independent smile", result.smile, {
    right: 2,
    left: 0,
  });
  for (const input of [
    { unknown: 1 },
    { blink: 1 },
    { blink: null },
    { blink: [] },
    { blink: { middle: 1 } },
    { blink: { right: null } },
    { blink: { left: "0" } },
    { jawOpen: {} },
    { jawOpen: null },
  ])
    TestValidator.predicate(
      "shape refusal",
      throwsError(() =>
        resolveHumanFaceExpression(
          input as Parameters<typeof resolveHumanFaceExpression>[0],
        ),
      ),
    );
};
