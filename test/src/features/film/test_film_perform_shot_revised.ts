import { performShot, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";

/**
 * Pins the revise rule and its tolerances: `revise.final` replaces the draft
 * wholesale when present, a camera may re-`frame` as long as it is the same
 * camera, and a node without a skeleton skips ROM validation instead of failing
 * it.
 *
 * Scenarios:
 *
 * 1. The draft is a single action by a stranger (`ghost`), unusable, but
 *    `revise.final` replaces it with `knightA` waving plus two `frame` calls on
 *    the same `cam-main` → success, proving the final list performed (a
 *    draft-path run would have failed on `ghost`).
 * 2. Only `knightA` performs, and the skeleton lookup returns null for it → the
 *    clip is accepted without ROM validation (the skeleton-less branch).
 */
export const test_film_perform_shot_revised = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const performed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "ghost",
          start: 0,
          duration: 1,
          kind: "wave",
        },
      ],
      revise: {
        review: "the draft actor does not exist; recast to knightA.",
        final: [
          {
            verb: "gesture",
            actor: "knightA",
            start: 0,
            duration: 1,
            kind: "wave",
          },
          {
            verb: "frame",
            actor: "cam-main",
            start: 0,
            duration: "auto",
            framing: "medium",
            move: "static",
            on: { kind: "node", node: "knightA" },
          },
          {
            verb: "frame",
            actor: "cam-main",
            start: 1,
            duration: "auto",
            framing: "close",
            move: "push-in",
            on: { kind: "node", node: "knightA" },
          },
        ],
      },
    }),
    synthesize: validSynthesizer,
    skeleton: () => null,
  });
  TestValidator.equals("success", performed.success, true);
  if (performed.success !== true) return;
  TestValidator.equals(
    "final list performed",
    performed.shot.performances.map((p) => p.node),
    ["knightA"],
  );
  TestValidator.equals("live camera", performed.shot.camera, "cam-main");
};
