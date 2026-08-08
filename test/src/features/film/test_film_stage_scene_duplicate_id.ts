import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

/**
 * Pins scene-wide id uniqueness: actors, cameras, and lights share one id
 * namespace (they all become scene entities), so a camera reusing an actor's id
 * is a collision, not a coincidence.
 *
 * Scenarios:
 *
 * 1. The camera node is renamed to `knightA`, colliding with the placed actor → a
 *    `type` violation on `$input.cameras[0].node`.
 */
export const test_film_stage_scene_duplicate_id = (): void => {
  const base = makeStagingWrite();
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      cameras: [{ ...base.cameras[0]!, node: "knightA" }],
    }),
  );
  TestValidator.equals("fails", staged.success, false);
  TestValidator.equals(
    "collision reported on the camera",
    namedFacts([
      ["refused", () => staged.success === false],
      [
        "violated",
        () =>
          staged.success === false &&
          hasViolation(staged, "type", "$input.cameras[0].node"),
      ],
    ]),
    { refused: true, violated: true },
  );
};
