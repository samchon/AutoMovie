import { blockBeat, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins non-finite timeline values that comparison-only gates can miss.
 *
 * Scenarios:
 *
 * 1. `duration = Infinity` yields `range` on `$input.duration`.
 * 2. `anchor.t = NaN` yields `range` on `$input.actors[0].anchors[0].t`.
 */
export const test_film_block_beat_non_finite_timeline = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const infiniteDuration = blockBeat(
    makeScriptWrite(),
    staged,
    makeBlockingWrite({ duration: Number.POSITIVE_INFINITY }),
  );
  TestValidator.equals(
    "infinite duration fails",
    infiniteDuration.success,
    false,
  );
  TestValidator.predicate(
    "infinite duration rejected",
    infiniteDuration.success === false &&
      hasViolation(infiniteDuration, "range", "$input.duration"),
  );

  const nanAnchor = blockBeat(
    makeScriptWrite(),
    staged,
    makeBlockingWrite({
      actors: [
        {
          node: "knightA",
          beats: "lands on an undefined cue time",
          anchors: [{ t: Number.NaN, cue: "undefined beat" }],
        },
      ],
    }),
  );
  TestValidator.equals("nan anchor fails", nanAnchor.success, false);
  TestValidator.predicate(
    "nan anchor rejected",
    nanAnchor.success === false &&
      hasViolation(nanAnchor, "range", "$input.actors[0].anchors[0].t"),
  );
};
