import { performShot, stageScene } from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMoviePerformanceApplication,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const gesture = (
  partial: Partial<IAutoMovieActionCall & { verb: "gesture" }> = {},
): IAutoMovieActionCall & { verb: "gesture" } => ({
  verb: "gesture",
  actor: "knightA",
  start: 0,
  duration: 1,
  kind: "wave",
  ...partial,
});

const run = (partial: Partial<IAutoMoviePerformanceApplication.IWrite>) => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");
  return performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [gesture()],
      revise: { review: "unchanged.", final: null },
      ...partial,
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
};

/**
 * Pins non-finite PERFORMANCE timing values before they feed shot span math.
 *
 * Scenarios:
 *
 * 1. `duration = Infinity` yields `range` on `$input.duration`.
 * 2. `draft[0].start = NaN` yields `range` on `$input.draft[0].start`.
 * 3. `draft[0].duration = Infinity` yields `range` on `$input.draft[0].duration`.
 */
export const test_film_perform_shot_non_finite_timing = (): void => {
  const infiniteShotDuration = run({
    duration: Number.POSITIVE_INFINITY,
  });
  TestValidator.equals(
    "infinite shot duration fails",
    infiniteShotDuration.success,
    false,
  );
  TestValidator.predicate(
    "infinite shot duration rejected",
    infiniteShotDuration.success === false &&
      hasViolation(infiniteShotDuration, "range", "$input.duration"),
  );

  const nanStart = run({
    draft: [gesture({ start: Number.NaN })],
  });
  TestValidator.equals("nan start fails", nanStart.success, false);
  TestValidator.predicate(
    "nan start rejected",
    nanStart.success === false &&
      hasViolation(nanStart, "range", "$input.draft[0].start"),
  );

  const infiniteActionDuration = run({
    duration: Number.POSITIVE_INFINITY,
    draft: [gesture({ duration: Number.POSITIVE_INFINITY })],
  });
  TestValidator.equals(
    "infinite action duration fails",
    infiniteActionDuration.success,
    false,
  );
  TestValidator.predicate(
    "infinite action duration rejected",
    infiniteActionDuration.success === false &&
      hasViolation(infiniteActionDuration, "range", "$input.draft[0].duration"),
  );
};
