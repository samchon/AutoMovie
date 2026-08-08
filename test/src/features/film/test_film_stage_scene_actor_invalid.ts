import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

/**
 * Pins actor placement numeric gates: staged positions become scene node
 * translations and `facingDeg` becomes a Y-axis quaternion, so both must be
 * finite before composition.
 *
 * Scenarios:
 *
 * 1. `knightA` declares a non-finite position, yielding `range` on
 *    `$input.actors[0].position`.
 * 2. `knightB` declares a non-finite facing angle, yielding `range` on
 *    `$input.actors[1].facingDeg`.
 */
export const test_film_stage_scene_actor_invalid = (): void => {
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      actors: [
        {
          node: "knightA",
          position: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
          facingDeg: 0,
        },
        {
          node: "knightB",
          position: { x: 0, y: 0, z: 0.7 },
          facingDeg: Number.POSITIVE_INFINITY,
        },
      ],
    }),
  );

  TestValidator.equals("fails", staged.success, false);
  TestValidator.equals(
    "non-finite position rejected",
    namedFacts([
      ["refused", () => staged.success === false],
      [
        "violated",
        () =>
          staged.success === false &&
          hasViolation(staged, "range", "$input.actors[0].position"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "non-finite facing rejected",
    namedFacts([
      ["refused", () => staged.success === false],
      [
        "violated",
        () =>
          staged.success === false &&
          hasViolation(staged, "range", "$input.actors[1].facingDeg"),
      ],
    ]),
    { refused: true, violated: true },
  );
};
