import { performShot, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins the referential and range gates of the PERFORMANCE consumer, all raised
 * from one incoherent write so the correction round sees the full list at
 * once.
 *
 * Scenarios:
 *
 * 1. The performance names a beat the script never planned → `type` on
 *    `$input.beat`.
 * 2. Its duration is 0 → `range` on `$input.duration`.
 * 3. Its only action is performed by an unstaged `ghost` → `type` on
 *    `$input.draft[0].actor`.
 * 4. That action starts at t = 5 s, outside the shot's [0, 0] span → `range` on
 *    `$input.draft[0].start`.
 * 5. A staged action with explicit duration 0 — `range` on
 *    `$input.draft[0].duration`.
 */
export const test_film_perform_shot_bad_refs = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const performed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-99",
      duration: 0,
      draft: [
        {
          verb: "gesture",
          actor: "ghost",
          start: 5,
          duration: 1,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("fails", performed.success, false);
  TestValidator.predicate(
    "unknown beat",
    performed.success === false &&
      hasViolation(performed, "type", "$input.beat"),
  );
  TestValidator.predicate(
    "zero duration",
    performed.success === false &&
      hasViolation(performed, "range", "$input.duration"),
  );
  TestValidator.predicate(
    "unstaged actor",
    performed.success === false &&
      hasViolation(performed, "type", "$input.draft[0].actor"),
  );
  TestValidator.predicate(
    "start out of shot",
    performed.success === false &&
      hasViolation(performed, "range", "$input.draft[0].start"),
  );

  const zeroActionDuration = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 0,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "zero action duration rejected",
    zeroActionDuration.success === false &&
      hasViolation(zeroActionDuration, "range", "$input.draft[0].duration"),
  );
};
