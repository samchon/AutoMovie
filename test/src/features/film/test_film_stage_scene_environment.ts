import {
  IAutoMovieStagedSet,
  stageScene,
  validateSceneEnvironment,
} from "@automovie/engine";
import {
  AutoMovieViolationKind,
  IAutoMovieSceneEnvironment,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

const ENVIRONMENT: IAutoMovieSceneEnvironment = {
  image: "assets/studio.hdr",
  background: null,
  intensity: 0.8,
  rotationDeg: 35,
  exposure: 1.1,
  toneMapping: "acesFilmic",
  shadows: { enabled: true, type: "pcfSoft" },
};

const refusedAt = (
  environment: unknown,
  kind: AutoMovieViolationKind,
  path: string,
): boolean => {
  const result = validateSceneEnvironment({
    environment: environment as IAutoMovieSceneEnvironment,
  });
  return result.success === false && hasViolation(result, kind, path);
};

const stagedWith = (environment: unknown): IAutoMovieStagedSet =>
  stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      environment: environment as IAutoMovieSceneEnvironment,
    }),
  );

/**
 * Environment and shadow settings are validated before they reach Three.js.
 *
 * Scenarios:
 *
 * 1. A complete image environment and shadowed light lower without losing any
 *    renderer-independent setting, while omitted environment data preserves the
 *    legacy scene shape.
 * 2. Every environment scalar, color, enum, exclusivity, and nested-object
 *    boundary fails at its authored path, with valid zero and extreme values
 *    retained.
 * 3. Shadow casting and deterministic shadow settings are declared together;
 *    malformed, missing, or inactive settings are refused before lowering.
 */
export const test_film_stage_scene_environment = (): void => {
  const staged = stagedWith(ENVIRONMENT);
  TestValidator.equals("valid environment stages", staged.success, true);
  if (staged.success === true)
    TestValidator.equals(
      "environment lowers verbatim",
      staged.scene.environment,
      ENVIRONMENT,
    );
  const bare = stageScene(makeScriptWrite(), makeStagingWrite());
  TestValidator.equals(
    "omitted environment preserves legacy scene bytes",
    namedFacts([
      ["staged", () => bare.success === true],
      [
        "noKey",
        () =>
          // The `success` comparison is restated only to narrow the union
          // inside this closure.
          bare.success === true && !("environment" in bare.scene),
      ],
    ]),
    { staged: true, noKey: true },
  );

  const color = { r: 0.1, g: 0.2, b: 0.3, a: null, hex: null };
  TestValidator.equals(
    "every environment gate is located",
    namedFacts([
      ["object", () => refusedAt(null, "type", "$input")],
      [
        "imageType",
        () => refusedAt({ ...ENVIRONMENT, image: 4 }, "type", "$input.image"),
      ],
      [
        "imageBlank",
        () => refusedAt({ ...ENVIRONMENT, image: " " }, "type", "$input.image"),
      ],
      [
        "background",
        () =>
          refusedAt(
            { ...ENVIRONMENT, image: null, background: 2 },
            "type",
            "$input.background",
          ),
      ],
      [
        "backgroundWithImage",
        () =>
          refusedAt(
            { ...ENVIRONMENT, background: color },
            "type",
            "$input.background",
          ),
      ],
      [
        "red",
        () =>
          refusedAt(
            { ...ENVIRONMENT, image: null, background: { ...color, r: -1 } },
            "range",
            "$input.background.r",
          ),
      ],
      [
        "green",
        () =>
          refusedAt(
            {
              ...ENVIRONMENT,
              image: null,
              background: { ...color, g: Infinity },
            },
            "range",
            "$input.background.g",
          ),
      ],
      [
        "blue",
        () =>
          refusedAt(
            {
              ...ENVIRONMENT,
              image: null,
              background: { ...color, b: "blue" },
            },
            "range",
            "$input.background.b",
          ),
      ],
      [
        "alpha",
        () =>
          refusedAt(
            { ...ENVIRONMENT, image: null, background: { ...color, a: 2 } },
            "range",
            "$input.background.a",
          ),
      ],
      [
        "hex",
        () =>
          refusedAt(
            {
              ...ENVIRONMENT,
              image: null,
              background: { ...color, hex: "red" },
            },
            "type",
            "$input.background.hex",
          ),
      ],
      [
        "intensity",
        () =>
          refusedAt(
            { ...ENVIRONMENT, intensity: -1 },
            "range",
            "$input.intensity",
          ),
      ],
      [
        "rotation",
        () =>
          refusedAt(
            { ...ENVIRONMENT, rotationDeg: NaN },
            "range",
            "$input.rotationDeg",
          ),
      ],
      [
        "exposure",
        () =>
          refusedAt(
            { ...ENVIRONMENT, exposure: 0 },
            "range",
            "$input.exposure",
          ),
      ],
      [
        "tone",
        () =>
          refusedAt(
            { ...ENVIRONMENT, toneMapping: "linear" },
            "type",
            "$input.toneMapping",
          ),
      ],
      [
        "shadows",
        () =>
          refusedAt(
            { ...ENVIRONMENT, shadows: null },
            "type",
            "$input.shadows",
          ),
      ],
      [
        "enabled",
        () =>
          refusedAt(
            { ...ENVIRONMENT, shadows: { enabled: 1, type: "pcf" } },
            "type",
            "$input.shadows.enabled",
          ),
      ],
      [
        "shadowType",
        () =>
          refusedAt(
            { ...ENVIRONMENT, shadows: { enabled: true, type: "hard" } },
            "type",
            "$input.shadows.type",
          ),
      ],
    ]),
    {
      object: true,
      imageType: true,
      imageBlank: true,
      background: true,
      backgroundWithImage: true,
      red: true,
      green: true,
      blue: true,
      alpha: true,
      hex: true,
      intensity: true,
      rotation: true,
      exposure: true,
      tone: true,
      shadows: true,
      enabled: true,
      shadowType: true,
    },
  );

  TestValidator.predicate(
    "solid background and renderer extremes validate",
    validateSceneEnvironment({
      environment: {
        ...ENVIRONMENT,
        image: null,
        background: color,
        intensity: 0,
        rotationDeg: -720,
        exposure: Number.MIN_VALUE,
        toneMapping: "none",
        shadows: { enabled: false, type: "vsm" },
      },
    }).success,
  );

  const standard = makeStagingWrite();
  const light = standard.lights[0]!;
  const shadowed = stageScene(makeScriptWrite(), {
    ...standard,
    lights: [
      {
        ...light,
        castShadow: true,
        shadow: {
          mapSize: 1024,
          bias: -0.0001,
          normalBias: 0.02,
          near: 0.1,
          far: 200,
        },
      },
    ],
  });
  TestValidator.equals(
    "shadow declaration lowers onto the scene light",
    namedFacts([
      ["staged", () => shadowed.success === true],
      [
        "castShadow",
        () =>
          shadowed.success === true &&
          shadowed.scene.lights[0]?.castShadow === true,
      ],
      [
        "mapSize",
        () =>
          shadowed.success === true &&
          shadowed.scene.lights[0]?.shadow?.mapSize === 1024,
      ],
    ]),
    { staged: true, castShadow: true, mapSize: true },
  );

  const invalidShadowCases: Array<[unknown, string]> = [
    [{ ...light, castShadow: "yes" }, "$input.lights[0].castShadow"],
    [{ ...light, castShadow: true }, "$input.lights[0].shadow"],
    [{ ...light, shadow: null }, "$input.lights[0].shadow"],
    [
      {
        ...light,
        castShadow: false,
        shadow: { mapSize: 1, bias: 0, normalBias: 0, near: 1, far: 2 },
      },
      "$input.lights[0].shadow",
    ],
    [
      {
        ...light,
        shadow: { mapSize: 0, bias: 0, normalBias: 0, near: 1, far: 2 },
      },
      "$input.lights[0].shadow.mapSize",
    ],
    [
      {
        ...light,
        shadow: { mapSize: 1, bias: NaN, normalBias: 0, near: 1, far: 2 },
      },
      "$input.lights[0].shadow.bias",
    ],
    [
      {
        ...light,
        shadow: { mapSize: 1, bias: 0, normalBias: Infinity, near: 1, far: 2 },
      },
      "$input.lights[0].shadow.normalBias",
    ],
    [
      {
        ...light,
        shadow: { mapSize: 1, bias: 0, normalBias: 0, near: 0, far: 2 },
      },
      "$input.lights[0].shadow.near",
    ],
    [
      {
        ...light,
        shadow: { mapSize: 1, bias: 0, normalBias: 0, near: 2, far: 2 },
      },
      "$input.lights[0].shadow.far",
    ],
  ];
  TestValidator.predicate(
    "invalid shadow fields fail at their authored paths",
    invalidShadowCases.every(([candidate, path]) => {
      const result = stageScene(makeScriptWrite(), {
        ...standard,
        lights: [candidate as typeof light],
      });
      return (
        result.success === false &&
        hasViolation(
          result,
          path.endsWith("castShadow") || path.endsWith("shadow")
            ? "type"
            : "range",
          path,
        )
      );
    }),
  );
};
