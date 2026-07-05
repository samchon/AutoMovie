import { blockBeat, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Blocking targets one script beat by id. Duplicate script beat ids make the
 * planned shot identity ambiguous for later performance, review, shot, and
 * slate lookups.
 *
 * Scenario: the script contains two `beat-1` entries while the blocking write
 * otherwise targets a valid staged actor/camera; blocking fails at the
 * duplicate script beat source path.
 */
export const test_film_block_beat_duplicate_script_beats = (): void => {
  const baseScript = makeScriptWrite();
  const staged = stageScene(baseScript, makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const blocked = blockBeat(
    makeScriptWrite({
      beats: [
        baseScript.beats[0]!,
        {
          ...baseScript.beats[0]!,
          name: "the duplicate charge",
          summary: "a second planned beat sharing the same id",
        },
      ],
    }),
    staged,
    makeBlockingWrite(),
  );

  TestValidator.equals(
    "duplicate script beat ids fail",
    blocked.success,
    false,
  );
  TestValidator.predicate(
    "duplicate script beat id violation",
    blocked.success === false &&
      hasViolation(blocked, "type", "$script.beats[1].id"),
  );
};
