import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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
  TestValidator.equals(
    "names the unplaced cast node",
    namedFacts([
      ["stagedSuccess", () => staged.success === false],
      [
        "hasViolationStaged",
        () => hasViolation(staged, "type", "$input.actors"),
      ],
      [
        "stagedViolations",
        () => staged.violations.some((v) => v.value === "knightB"),
      ],
    ]),
    {
      stagedSuccess: true,
      hasViolationStaged: true,
      stagedViolations: true,
    },
  );
};
