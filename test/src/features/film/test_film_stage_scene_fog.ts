import { stageScene } from "@automovie/engine";
import { IAutoMovieFog, IAutoMovieStagedSet } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

const FOG: IAutoMovieFog = {
  density: 0.015,
  color: { r: 0.7, g: 0.74, b: 0.8, a: null, hex: null },
};

/** Stage the standard set with `fog` replaced by whatever a case submits. */
const stagedWith = (fog: unknown): IAutoMovieStagedSet =>
  stageScene(
    makeScriptWrite(),
    makeStagingWrite({ fog: fog as IAutoMovieFog }),
  );

/**
 * Staging may author the set's atmosphere, and the gate that accepts it is the
 * one the scene artifact applies downstream.
 *
 * Fog is a scene property, so `stage`, which is the rung that composes scenes,
 * has to be able to state one; otherwise the field is declarable in the schema
 * and unreachable from the only authoring path that builds a scene. Two facts
 * carry it and both are checked, because both fail silently rather than loudly:
 * a negative or non-finite `density` feeds `exp(-(density*d)^2)` a number the
 * shader paints as a dead frame, and an out-of-range color puts a horizon on
 * screen that no light in the scene could make.
 *
 * Scenarios:
 *
 * 1. A declared fog is lowered verbatim onto the composed scene.
 * 2. An omitted fog composes a scene with NO `fog` key, not `fog: null`: an
 *    atmosphere is something most sets do not have, and writing null onto every
 *    staged scene ever composed would change the bytes, and the content digest,
 *    of every production that never mentioned it.
 * 3. Each gate fires at the submitted field: a fog that is not an object, a
 *    negative density, a non-finite density, a color that is not an object, and
 *    a color component outside `[0, 1]`.
 * 4. The negative twin: a zero density is a vacuum, not a mistake, and an
 *    enormous one is a wall of cloud, which is a look. Neither is refused.
 */
export const test_film_stage_scene_fog = (): void => {
  // 1. lowered verbatim.
  const staged = stagedWith(FOG);
  TestValidator.equals("staging with a fog succeeds", staged.success, true);
  if (staged.success !== true) return;
  TestValidator.equals(
    "the atmosphere is carried onto the scene",
    staged.scene.fog,
    FOG,
  );

  // 2. omitted is omitted, down to the key.
  const bare = stageScene(makeScriptWrite(), makeStagingWrite());
  TestValidator.equals(
    "an omitted fog composes no fog key at all",
    namedFacts([
      ["staged", () => bare.success === true],
      [
        "keyAbsent",
        () => bare.success === true && "fog" in bare.scene === false,
      ],
    ]),
    { staged: true, keyAbsent: true },
  );

  // 3. every gate reports under the submitted field.
  TestValidator.equals(
    "each malformed atmosphere is refused where it was written",
    namedFacts([
      [
        "notAnObject",
        () => hasViolation(stagedWith(null), "type", "$input.fog"),
      ],
      [
        "negativeDensity",
        () =>
          hasViolation(
            stagedWith({ ...FOG, density: -0.01 }),
            "range",
            "$input.fog.density",
          ),
      ],
      [
        "nonFiniteDensity",
        () =>
          hasViolation(
            stagedWith({ ...FOG, density: Number.POSITIVE_INFINITY }),
            "range",
            "$input.fog.density",
          ),
      ],
      [
        "densityNotANumber",
        () =>
          hasViolation(
            stagedWith({ ...FOG, density: "thick" }),
            "range",
            "$input.fog.density",
          ),
      ],
      [
        "colorNotAnObject",
        () =>
          hasViolation(
            stagedWith({ ...FOG, color: null }),
            "type",
            "$input.fog.color",
          ),
      ],
      [
        "componentOutOfRange",
        () =>
          hasViolation(
            stagedWith({ ...FOG, color: { ...FOG.color, g: 1.4 } }),
            "range",
            "$input.fog.color.g",
          ),
      ],
    ]),
    {
      notAnObject: true,
      negativeDensity: true,
      nonFiniteDensity: true,
      densityNotANumber: true,
      colorNotAnObject: true,
      componentOutOfRange: true,
    },
  );

  // 4. the negative twin: extremes that are looks, not mistakes.
  TestValidator.equals(
    "a vacuum and a wall of cloud both stage clean",
    namedFacts([
      ["vacuum", () => stagedWith({ ...FOG, density: 0 }).success === true],
      ["cloud", () => stagedWith({ ...FOG, density: 5 }).success === true],
    ]),
    { vacuum: true, cloud: true },
  );
};
