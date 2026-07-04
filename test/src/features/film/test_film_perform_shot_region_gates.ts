import { performShot, stageScene } from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieCameraAction,
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

const locomote: IAutoMovieActionCall = {
  verb: "locomote",
  actor: "knightA",
  start: 0,
  duration: 1,
  gait: "walk",
  to: { kind: "point", point: { x: 0, y: 0, z: 0.25 } },
};

const fullBody = (start: number): IAutoMovieActionCall => ({
  verb: "gesture",
  kind: "jump",
  region: "fullBody",
  actor: "knightA",
  start,
  duration: 1,
});

const frame: IAutoMovieCameraAction = {
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
};

/**
 * Region gates that sit above the body-region clip masking. `fullBody` owns the
 * entire rig, so it cannot run concurrently with a partial region action for
 * the same actor. Adjacent, non-overlapping actions still sequence normally.
 */
export const test_film_perform_shot_region_gates = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const overlapping = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [locomote, fullBody(0.5), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "overlapping fullBody + partial fails",
    overlapping.success,
    false,
  );
  TestValidator.predicate(
    "fullBody overlap is reported on the later action start",
    overlapping.success === false &&
      hasViolation(overlapping, "range", "$input.draft[1].start"),
  );

  const adjacent = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [locomote, fullBody(1), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "adjacent fullBody + partial passes",
    adjacent.success,
    true,
  );
};
