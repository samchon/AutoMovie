import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins the light gates: intensity is physical (non-negative) and a directional
 * light needs an actual direction — the zero vector aims a light nowhere and
 * would degenerate the aim rotation.
 *
 * Scenarios:
 *
 * 1. The sun's intensity is −1 → a `range` violation on
 *    `$input.lights[0].intensity`.
 * 2. A second light declares the zero direction → a `range` violation on
 *    `$input.lights[1].direction`.
 */
export const test_film_stage_scene_light_invalid = (): void => {
  const base = makeStagingWrite();
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      lights: [
        { ...base.lights[0]!, intensity: -1 },
        {
          node: "void",
          role: "fill",
          direction: { x: 0, y: 0, z: 0 },
          intensity: 0.5,
        },
      ],
    }),
  );
  TestValidator.equals("fails", staged.success, false);
  TestValidator.predicate(
    "negative intensity rejected",
    staged.success === false &&
      hasViolation(staged, "range", "$input.lights[0].intensity"),
  );
  TestValidator.predicate(
    "zero direction rejected",
    staged.success === false &&
      hasViolation(staged, "range", "$input.lights[1].direction"),
  );
};
