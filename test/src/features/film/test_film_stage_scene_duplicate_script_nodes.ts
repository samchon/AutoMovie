import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Staging joins placed actors to the script cast by `node`, then chooses each
 * scene node's model with `modelRef ?? node`. Duplicate script cast nodes make
 * that model choice order-dependent.
 *
 * Scenario: `knightA` appears twice in the script cast with conflicting
 * `modelRef` values while both staged actors are otherwise valid; staging fails
 * at the duplicate script source path instead of silently using the later cast
 * member.
 */
export const test_film_stage_scene_duplicate_script_nodes = (): void => {
  const staged = stageScene(
    makeScriptWrite({
      cast: [
        {
          node: "knightA",
          character: "the imported challenger",
          modelRef: "stickman",
        },
        {
          node: "knightA",
          character: "the generated impostor",
          modelRef: null,
        },
        { node: "knightB", character: "the champion", modelRef: null },
      ],
    }),
    makeStagingWrite(),
  );

  TestValidator.equals(
    "duplicate script cast nodes fail",
    staged.success,
    false,
  );
  TestValidator.predicate(
    "duplicate script cast node violation",
    staged.success === false &&
      hasViolation(staged, "type", "$script.cast[1].node"),
  );
};
