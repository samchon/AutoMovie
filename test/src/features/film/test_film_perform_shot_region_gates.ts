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

const lookAt = (start: number): IAutoMovieActionCall => ({
  verb: "lookAt",
  actor: "knightA",
  start,
  duration: 1,
  to: { kind: "node", node: "knightB" },
});

const emote = (start: number): IAutoMovieActionCall => ({
  verb: "emote",
  actor: "knightA",
  start,
  duration: 1,
  preset: "neutral",
  intensity: 0.5,
});

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
 * the same actor — EXCEPT `face` (#1062): an emote carries expression only,
 * which no gesture clip authors, so the combination is content-disjoint.
 * Same-region overlaps are also ambiguous because the same bones cannot play
 * two authored clips at once. Adjacent same-region actions still sequence
 * normally, and disjoint partial regions still layer.
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

  const sameRegion = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [lookAt(0), lookAt(0.5), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "overlapping same-region actions fail",
    sameRegion.success,
    false,
  );
  TestValidator.predicate(
    "same-region overlap is reported on the later action start",
    sameRegion.success === false &&
      hasViolation(sameRegion, "range", "$input.draft[1].start"),
  );

  const layeredPartials = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [lookAt(0), emote(0.25), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "overlapping disjoint partial regions pass",
    layeredPartials.success,
    true,
  );

  // face carries expression only — no gesture clip authors it, so a fullBody
  // action overlapping an emote is content-disjoint: smile-while-bowing is
  // legal (#1062), while head (which whole-body clips may author) still gates
  const smileWhileJumping = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [fullBody(0), emote(0.25), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "an emote overlapping a fullBody gesture passes",
    smileWhileJumping.success,
    true,
  );
  const lookWhileJumping = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [fullBody(0), lookAt(0.25), frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "a head action overlapping a fullBody gesture still gates",
    lookWhileJumping.success === false &&
      hasViolation(lookWhileJumping, "range", "$input.draft[1].start"),
  );
};
