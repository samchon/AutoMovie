import { sceneFogTransmittance } from "@automovie/engine";
import { IAutoMovieFog, IAutoMovieScene } from "@automovie/interface";
import { applyRenderMode, buildModel, buildScene } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { namedFacts, nclose } from "../internal/predicates";

const FOG: IAutoMovieFog = {
  density: 0.02,
  color: { r: 0.25, g: 0.5, b: 0.75, a: null, hex: null },
};

const sceneOf = (fog: IAutoMovieScene["fog"]) =>
  buildScene(
    {
      id: "scene-1",
      name: null,
      nodes: [
        {
          id: "node-a",
          model: "model-a",
          transform: IDENTITY_TRANSFORM,
          motion: null,
          pose: null,
        },
      ],
      cameras: [],
      lights: [],
      fog,
    },
    () => buildModel({ ...createModel(), id: "model-a" }),
  ).scene;

/** The exact expression `three.js` evaluates per fragment under `FOG_EXP2`. */
const shaderTransmittance = (fog: THREE.FogExp2, depth: number): number =>
  1 - (1 - Math.exp(-fog.density * fog.density * depth * depth));

/**
 * Scene fog (`IAutoMovieScene.fog`): the depth cue an exterior needs, declared
 * once and read the same way by everything that reads it.
 *
 * Before this the only way to suggest distance was to spend the particle budget
 * on alpha billboards standing in for haze, capped at 4,096 per recipe: on open
 * ground every surface read at the same remove, because nothing in the scene
 * said how far anything was. Fog costs no particles, applies to every drawn
 * surface, and is one declaration for the whole scene.
 *
 * The law is exactly the renderer's own, `T(d) = exp(-(density*d)^2)`, so the
 * number an offline consumer computes IS the number the GPU painted rather than
 * an approximation of it. This test holds the two together from both ends: the
 * viewer's built `FogExp2` and the engine's `sceneFogTransmittance` must agree
 * at every depth, and the shader's own expression, written out here from
 * `fog_fragment.glsl`, must agree with both.
 *
 * Scenarios:
 *
 * 1. Absent is absent: a scene that says nothing about fog, and one that says
 *    `null`, both leave `scene.fog` unset, which is `three.js`'s own no-fog and
 *    therefore byte-identical to every frame rendered before the field existed.
 *    The engine agrees, returning a transmittance of exactly one.
 * 2. A declared fog reaches the renderer verbatim: the density is the authored
 *    number and the color is the authored linear triple, unconverted.
 * 3. Viewer and engine derive the same value from the same declaration, at
 *    every depth and to the shader's own formula, and the half-visibility
 *    distance is where `IAutoMovieFog` says it is.
 * 4. Distance is what fog reads: a subject twice as far keeps far less than
 *    half as much of itself, monotonically, which is the whole point of having
 *    it.
 * 5. Structural guide passes suspend it and put it back: a mask must not tint
 *    its palette with distance, and the beauty pass, which IS the film, keeps
 *    it.
 */
export const test_viewer_scene_fog = (): void => {
  // 1. absent is absent.
  TestValidator.equals(
    "a scene declaring no fog builds no fog, and reads as fully transmissive",
    namedFacts([
      ["undeclared", () => sceneOf(undefined).fog === null],
      ["explicitNull", () => sceneOf(null).fog === null],
      ["engineUndefined", () => sceneFogTransmittance(undefined, 250) === 1],
      ["engineNull", () => sceneFogTransmittance(null, 250) === 1],
    ]),
    {
      undeclared: true,
      explicitNull: true,
      engineUndefined: true,
      engineNull: true,
    },
  );

  // 2. a declared fog reaches the renderer verbatim.
  const built = sceneOf(FOG).fog;
  if (!(built instanceof THREE.FogExp2))
    throw new Error("a declared fog must build an exponential fog");
  TestValidator.equals(
    "the built fog carries the authored density and linear color unconverted",
    namedFacts([
      ["density", () => built.density === FOG.density],
      ["red", () => nclose(built.color.r, FOG.color.r, 1e-6)],
      ["green", () => nclose(built.color.g, FOG.color.g, 1e-6)],
      ["blue", () => nclose(built.color.b, FOG.color.b, 1e-6)],
    ]),
    { density: true, red: true, green: true, blue: true },
  );

  // 3. one law, three readers.
  const depths = [0, 1, 5, 20, 83.26, 250];
  TestValidator.equals(
    "viewer, engine and shader agree at every depth",
    namedFacts([
      [
        "engineMatchesShader",
        () =>
          depths.every((depth) =>
            nclose(
              sceneFogTransmittance(FOG, depth),
              shaderTransmittance(built, depth),
              1e-12,
            ),
          ),
      ],
      ["atTheLens", () => sceneFogTransmittance(FOG, 0) === 1],
      [
        "halfVisibility",
        () =>
          nclose(
            sceneFogTransmittance(FOG, Math.sqrt(Math.LN2) / FOG.density),
            0.5,
            1e-12,
          ),
      ],
    ]),
    { engineMatchesShader: true, atTheLens: true, halfVisibility: true },
  );

  // 4. distance is what fog reads.
  TestValidator.equals(
    "a farther subject keeps less of itself, monotonically",
    namedFacts([
      [
        "monotone",
        () =>
          depths.every(
            (depth, index) =>
              index === 0 ||
              sceneFogTransmittance(FOG, depth) <
                sceneFogTransmittance(FOG, depths[index - 1]!),
          ),
      ],
      [
        "fasterThanLinear",
        () =>
          sceneFogTransmittance(FOG, 100) <
          0.5 * sceneFogTransmittance(FOG, 50),
      ],
      ["nearlyGoneFarOff", () => sceneFogTransmittance(FOG, 250) < 0.01],
    ]),
    { monotone: true, fasterThanLinear: true, nearlyGoneFarOff: true },
  );

  // 5. structural passes suspend it; the beauty pass keeps it.
  const scene = sceneOf(FOG);
  const declared = scene.fog;
  const mask = applyRenderMode(scene, "mask");
  const suspended = scene.fog;
  mask.restore();
  const beauty = applyRenderMode(scene, "beauty");
  const duringBeauty = scene.fog;
  beauty.restore();
  TestValidator.equals(
    "a structural pass drops the atmosphere and restores the same object",
    namedFacts([
      ["suspendedDuringMask", () => suspended === null],
      ["restoredAfterMask", () => scene.fog === declared],
      ["keptDuringBeauty", () => duringBeauty === declared],
    ]),
    {
      suspendedDuringMask: true,
      restoredAfterMask: true,
      keptDuringBeauty: true,
    },
  );
};
