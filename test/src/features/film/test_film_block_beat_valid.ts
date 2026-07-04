import { blockBeat, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";

/**
 * Pins the happy path of the BLOCKING consumer: a plan whose beat the script
 * planned, whose intents belong to placed actors, whose anchors sit on the
 * beat's timeline in causal order, and whose camera favours a staged actor
 * passes through verbatim.
 *
 * Scenarios:
 *
 * 1. The duel blocking (strike anchored at t = 1 inside a 2-second beat, medium
 *    static camera on knightA) ??success carrying the plan unchanged.
 * 2. Multiple anchors in ascending order (0.5 then 1.5) ??still coherent.
 */
export const test_film_block_beat_valid = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const blocked = blockBeat(makeScriptWrite(), staged, makeBlockingWrite());
  TestValidator.equals("success", blocked.success, true);
  if (blocked.success === true)
    TestValidator.equals(
      "plan carried verbatim",
      blocked.blocking.beat,
      "beat-1",
    );

  const anchored = blockBeat(
    makeScriptWrite(),
    staged,
    makeBlockingWrite({
      actors: [
        {
          node: "knightA",
          beats: "steps in, feints, then strikes",
          anchors: [
            { t: 0.5, cue: "the feint" },
            { t: 1.5, cue: "the strike lands" },
          ],
        },
      ],
    }),
  );
  TestValidator.equals("ordered anchors pass", anchored.success, true);
};
