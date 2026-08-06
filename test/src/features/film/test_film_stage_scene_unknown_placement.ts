import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

/**
 * Pins the inverse referential gate: staging may only place nodes the script
 * cast: a placement naming a stranger is a contradiction with the plan, not a
 * new character.
 *
 * Scenarios:
 *
 * 1. Staging places a third node `ghost` the cast never mentions (both cast
 *    knights properly placed) → a `type` violation on `$input.actors[2].node`
 *    carrying "ghost".
 */
export const test_film_stage_scene_unknown_placement = (): void => {
  const base = makeStagingWrite();
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      actors: [
        ...base.actors,
        { node: "ghost", position: { x: 1, y: 0, z: 1 }, facingDeg: 0 },
      ],
    }),
  );
  TestValidator.equals("fails", staged.success, false);
  TestValidator.equals(
    "names the stranger",
    namedFacts([
      ["stagedSuccess", () => staged.success === false],
      [
        "hasViolationStagedType",
        () =>
          staged.success === false &&
          hasViolation(staged, "type", "$input.actors[2].node"),
      ],
      [
        "stagedViolationsV",
        () =>
          staged.success === false &&
          staged.violations.some((v) => v.value === "ghost"),
      ],
    ]),
    {
      stagedSuccess: true,
      hasViolationStagedType: true,
      stagedViolationsV: true,
    },
  );
};
