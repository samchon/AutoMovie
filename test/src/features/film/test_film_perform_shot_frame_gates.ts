import { performShot, stageScene } from "@autofilm/engine";
import { IAutoFilmCameraAction } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const frame = (
  overrides: Partial<IAutoFilmCameraAction>,
): IAutoFilmCameraAction => ({
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
  ...overrides,
});

/**
 * Pins the frame-authoring gates that camera compilation added to the
 * PERFORMANCE consumer: a frame subject must be a positional target, and two
 * moves cannot double-book the one live camera.
 *
 * Scenarios:
 *
 * 1. A frame aimed at `{kind: "direction"}` (a heading, not a point) → a `type`
 *    violation on `$input.draft[0].on`.
 * 2. A 1.5-second move starting at 0 followed by another starting at 1.0 on the
 *    same camera → a `range` violation on the second's `start` (the first still
 *    owns the camera until 1.5 s).
 */
export const test_film_perform_shot_frame_gates = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const directed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [frame({ on: { kind: "direction", headingDeg: 90 } })],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("directional subject fails", directed.success, false);
  TestValidator.predicate(
    "non-positional frame subject rejected",
    directed.success === false &&
      hasViolation(directed, "type", "$input.draft[0].on"),
  );

  const doubled = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        frame({ start: 0, duration: 1.5 }),
        frame({ start: 1.0, move: "push-in" }),
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("overlapping moves fail", doubled.success, false);
  TestValidator.predicate(
    "double-booked camera rejected",
    doubled.success === false &&
      hasViolation(doubled, "range", "$input.draft[1].start"),
  );
};
