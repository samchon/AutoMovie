import { performShot, stageScene } from "@automovie/engine";
import { IAutoMovieActionCall } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { vclose } from "../internal/predicates";

const staged = (() => {
  const result = stageScene(makeScriptWrite(), makeStagingWrite());
  if (result.success !== true) throw new Error("staging fixture must succeed");
  return result;
})();

/** Perform the beat-1 fixture with its frame action swapped for `frame`. */
const perform = (frame: IAutoMovieActionCall) => {
  const base = makePerformanceWrite();
  return performShot({
    script: makeScriptWrite(),
    staged,
    performance: {
      ...base,
      draft: [...base.draft.slice(0, 2), frame],
    },
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
};

const frameAction = (
  over: Partial<Extract<IAutoMovieActionCall, { verb: "frame" }>> = {},
): IAutoMovieActionCall => ({
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
  ...over,
});

/**
 * The camera-intent guide metadata (#1187): a frame action may carry a `focus`
 * target and a `focalLength` — structural INTENT for a diffusion/render host,
 * never consumed by the deterministic camera solve. `performShot` validates
 * them like any target/scalar and emits the resolved record on
 * `shot.cameraIntent`, exactly as it emits `shot.events`.
 *
 * Scenarios:
 *
 * 1. A frame with `focus: knightB` and `focalLength: 85` emits one intent entry
 *    carrying the framing/move, knightB's staged world point, and 85 mm.
 * 2. Omitting both intents emits the entry with `focus`/`focalLength` null — and
 *    the compiled `cameraMotion` is byte-identical with or without the intents
 *    (the solve never reads them).
 * 3. A focus target naming an unstaged node is a `type` violation at `.focus`; a
 *    zero and a non-finite `focalLength` are `range` violations at
 *    `.focalLength`.
 */
export const test_film_camera_intent = (): void => {
  // 1. intents ride to shot.cameraIntent.
  const withIntent = perform(
    frameAction({
      focus: { kind: "node", node: "knightB" },
      focalLength: 85,
    }),
  );
  TestValidator.equals("performs", withIntent.success, true);
  if (withIntent.success !== true) return;
  const intent = withIntent.shot.cameraIntent!;
  TestValidator.equals("one intent entry", intent.length, 1);
  TestValidator.equals(
    "framing and move carried",
    [intent[0]!.framing, intent[0]!.move, intent[0]!.focalLength],
    ["medium", "static", 85],
  );
  TestValidator.predicate(
    "focus resolves to knightB's staged point",
    vclose(intent[0]!.focus!, { x: 0, y: 0, z: 0.7 }),
  );

  // 2. omitted intents are null, and the solve is untouched by them.
  const without = perform(frameAction());
  TestValidator.equals("performs without intents", without.success, true);
  if (without.success !== true) return;
  TestValidator.equals(
    "omitted intents are null",
    [
      without.shot.cameraIntent![0]!.focus,
      without.shot.cameraIntent![0]!.focalLength,
    ],
    [null, null],
  );
  TestValidator.equals(
    "the camera solve is byte-identical with or without intents",
    JSON.stringify(withIntent.shot.cameraMotion),
    JSON.stringify(without.shot.cameraMotion),
  );

  // 3. gates.
  const ghost = perform(
    frameAction({ focus: { kind: "node", node: "ghost" } }),
  );
  TestValidator.predicate(
    "an unstaged focus node is a type violation",
    ghost.success === false &&
      ghost.violations.some(
        (v) => v.kind === "type" && v.path.includes(".focus"),
      ),
  );
  const zeroLens = perform(frameAction({ focalLength: 0 }));
  TestValidator.predicate(
    "a zero focal length is a range violation",
    zeroLens.success === false &&
      zeroLens.violations.some(
        (v) => v.kind === "range" && v.path.includes(".focalLength"),
      ),
  );
  const nanLens = perform(frameAction({ focalLength: Number.NaN }));
  TestValidator.predicate(
    "a non-finite focal length is a range violation",
    nanLens.success === false &&
      nanLens.violations.some(
        (v) => v.kind === "range" && v.path.includes(".focalLength"),
      ),
  );
};
