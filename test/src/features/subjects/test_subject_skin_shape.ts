import {
  portraitSkinParameters,
  resolvePortraitSkinShape,
} from "@automovie/human/components/skinShape";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Skin condition is a bounded authoring profile, independent of chronological age.
 *
 * Scenarios:
 * 1. Omitted condition is taut and has no expression creasing; outputs are owned.
 * 2. Each exact bound is admitted and values just beyond it, null and nonfinite
 *    values refuse rather than being clamped or interpreted as a default.
 */
export const test_subject_skin_shape = (): void => {
  const a = resolvePortraitSkinShape(),
    b = resolvePortraitSkinShape({});
  TestValidator.equals(
    "legacy skin has no folds",
    [a.laxity, a.expressionCreasing],
    [0, 0],
  );
  TestValidator.equals("explicit empty defaults", a, b);
  a.laxity = 1;
  TestValidator.equals("defaults owned", b.laxity, 0);
  const input = { laxity: 0.5 },
    resolved = resolvePortraitSkinShape(input);
  input.laxity = 0;
  TestValidator.equals("input owned", resolved.laxity, 0.5);
  for (const p of portraitSkinParameters) {
    for (const value of [p.minimum, p.maximum])
      TestValidator.equals(
        "exact editing bound",
        resolvePortraitSkinShape({ [p.id]: value })[p.id],
        value,
      );
    for (const value of [
      p.minimum - 0.001,
      p.maximum + 0.001,
      NaN,
      Infinity,
      -Infinity,
      null as unknown as number,
    ])
      TestValidator.predicate(
        "invalid setting refused",
        throwsError(() => resolvePortraitSkinShape({ [p.id]: value })),
      );
  }
};
