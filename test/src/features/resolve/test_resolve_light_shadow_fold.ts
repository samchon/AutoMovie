import { applyLightOverride } from "@automovie/engine";
import { IAutoMovieLight, IAutoMovieLightShadow } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const SHADOW: IAutoMovieLightShadow = {
  mapSize: 2048,
  bias: -0.0005,
  normalBias: 0.03,
  near: 0.5,
  far: 120,
};

const KEY: IAutoMovieLight = {
  id: "key",
  type: "spot",
  transform: {
    translation: { x: 0, y: 4, z: 2 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  color: { r: 1, g: 0.96, b: 0.9, a: null, hex: null },
  intensity: 8,
  range: 0,
  coneAngle: 35,
  castShadow: true,
  shadow: SHADOW,
};

/**
 * Folding a shot's lighting over a light preserves the renderer policy it was
 * staged with.
 *
 * `applyLightOverride` rebuilds each light kind from an explicit base so a
 * parameter one kind lacks cannot leak into another. That base is also the one
 * place a field with no animation channel can be silently dropped, which is
 * what `castShadow` and `shadow` were: dimming a lamp over a beat rebuilt it
 * without either, so a key light stopped occluding at the first keyframe that
 * touched it and nothing failed.
 *
 * Scenarios:
 *
 * 1. A shadow-casting key whose intensity a clip drives keeps `castShadow` and the
 *    exact staged shadow settings, by identity rather than by copy.
 * 2. A light staged without either keeps BOTH keys absent, so a folded light and
 *    an untouched one serialize to the same bytes and no legacy production
 *    changes its content digest.
 * 3. A light no track addresses is still returned by identity, the guarantee the
 *    fold gives for an unaddressed light.
 */
export const test_resolve_light_shadow_fold = (): void => {
  const dimmed = applyLightOverride(KEY, { intensity: 2 });
  TestValidator.equals(
    "an animated key keeps casting exactly the shadow it was staged with",
    namedFacts([
      ["dimmed", () => dimmed.intensity === 2],
      ["casts", () => dimmed.castShadow === true],
      ["sameSettings", () => dimmed.shadow === SHADOW],
      ["stillSpot", () => dimmed.type === "spot"],
      ["coneKept", () => dimmed.type === "spot" && dimmed.coneAngle === 35],
    ]),
    {
      dimmed: true,
      casts: true,
      sameSettings: true,
      stillSpot: true,
      coneKept: true,
    },
  );

  const legacy: IAutoMovieLight = {
    id: "lamp",
    type: "point",
    transform: KEY.transform,
    color: KEY.color,
    intensity: 1,
    range: 6,
  };
  const folded = applyLightOverride(legacy, { range: 9 });
  TestValidator.equals(
    "a legacy light gains neither key and keeps its exact byte shape",
    [
      Object.keys(folded).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
      folded.type === "point" ? folded.range : -1,
    ],
    [["color", "id", "intensity", "range", "transform", "type"], 9],
  );

  TestValidator.equals(
    "an empty override reproduces the staged light value for value",
    applyLightOverride(KEY, {}),
    KEY,
  );
};
