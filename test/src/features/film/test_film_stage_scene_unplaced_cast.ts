import { stageScene } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins the "everyone in the cast must stand somewhere" gate: a cast member
 * staging never places can never appear on screen, so staging fails rather than
 * silently dropping the character.
 *
 * Scenarios:
 *
 * 1. Staging places only `knightA` while the script casts two knights → a `type`
 *    violation on `$input.actors` naming the unplaced `knightB`, and no scene
 *    is composed.
 */
export const test_film_stage_scene_unplaced_cast = (): void => {
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      actors: [
        { node: "knightA", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
      ],
    }),
  );
  TestValidator.equals("fails", staged.success, false);
  TestValidator.predicate(
    "names the unplaced cast node",
    staged.success === false &&
      hasViolation(staged, "type", "$input.actors") &&
      staged.violations.some((v) => v.value === "knightB"),
  );
};
