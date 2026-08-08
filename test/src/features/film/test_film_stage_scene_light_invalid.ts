import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

/**
 * Pins the light gates: intensity is physical (non-negative) and a directional
 * light needs an actual direction: the zero vector aims a light nowhere and
 * would degenerate the aim rotation.
 *
 * Scenarios:
 *
 * 1. The sun's intensity is −1 → a `range` violation on
 *    `$input.lights[0].intensity`.
 * 2. A second light declares the zero direction → a `range` violation on
 *    `$input.lights[1].direction`.
 * 3. A third light declares infinite intensity, yielding `range` on
 *    `$input.lights[2].intensity`.
 * 4. A fourth light declares a non-finite direction, yielding `range` on
 *    `$input.lights[3].direction`.
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
        {
          node: "nova",
          role: "rim",
          direction: { x: 0, y: -1, z: 0 },
          intensity: Number.POSITIVE_INFINITY,
        },
        {
          node: "skew",
          role: "rim",
          direction: { x: Number.POSITIVE_INFINITY, y: -1, z: 0 },
          intensity: 0.5,
        },
      ],
    }),
  );
  TestValidator.equals("fails", staged.success, false);
  TestValidator.equals(
    "negative intensity rejected",
    namedFacts([
      ["refused", () => staged.success === false],
      [
        "violated",
        () =>
          staged.success === false &&
          hasViolation(staged, "range", "$input.lights[0].intensity"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "zero direction rejected",
    namedFacts([
      ["refused", () => staged.success === false],
      [
        "violated",
        () =>
          staged.success === false &&
          hasViolation(staged, "range", "$input.lights[1].direction"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "infinite intensity rejected",
    namedFacts([
      ["refused", () => staged.success === false],
      [
        "violated",
        () =>
          staged.success === false &&
          hasViolation(staged, "range", "$input.lights[2].intensity"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "non-finite direction rejected",
    namedFacts([
      ["refused", () => staged.success === false],
      [
        "violated",
        () =>
          staged.success === false &&
          hasViolation(staged, "range", "$input.lights[3].direction"),
      ],
    ]),
    { refused: true, violated: true },
  );
};
