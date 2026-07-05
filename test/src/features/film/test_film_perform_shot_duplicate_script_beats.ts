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
 * Performance emits shot ids, camera clip ids, and review/slate keys from the
 * script beat id. Duplicate script beat ids make that shot identity ambiguous
 * even when the action list itself is coherent.
 *
 * Scenario: the script contains two `beat-1` entries while the performance
 * otherwise targets a valid staged beat; performance fails at the duplicate
 * script beat source path.
 */
export const test_film_perform_shot_duplicate_script_beats = (): void => {
  const baseScript = makeScriptWrite();
  const staged = stageScene(baseScript, makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const performed = performShot({
    script: makeScriptWrite({
      beats: [
        baseScript.beats[0]!,
        {
          ...baseScript.beats[0]!,
          name: "the duplicate charge",
          summary: "another planned shot sharing the same beat id",
        },
      ],
    }),
    staged,
    performance: makePerformanceWrite(),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });

  TestValidator.equals(
    "duplicate script beat ids fail",
    performed.success,
    false,
  );
  TestValidator.predicate(
    "duplicate script beat id violation",
    performed.success === false &&
      hasViolation(performed, "type", "$script.beats[1].id"),
  );
};
