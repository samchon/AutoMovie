import { IAutoMovieClip, IAutoMovieScene } from "@automovie/interface";
import { applyLightMotion, buildScene } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [],
  cameras: [],
  lights: [
    {
      id: "candleGlow",
      type: "point",
      transform: IDENTITY_TRANSFORM,
      color: { r: 1, g: 0.8, b: 0.5, a: null, hex: null },
      intensity: 1.4,
      range: 4,
    },
    {
      id: "lamp",
      type: "spot",
      transform: IDENTITY_TRANSFORM,
      color: { r: 1, g: 1, b: 1, a: null, hex: null },
      intensity: 2,
      range: 10,
      coneAngle: 40,
    },
  ],
  space: null,
};

/** A one-track light clip on the beat's three-second clock. */
const clip = (
  id: string,
  pointer: string,
  valueType: "scalar" | "vec3",
  times: number[],
  values: number[],
  interpolation: "step" | "linear",
): IAutoMovieClip => ({
  id,
  name: null,
  duration: 3,
  loop: false,
  tracks: [
    {
      channel: { kind: "pointer", pointer, valueType },
      times,
      values,
      interpolation,
    },
  ],
});

/**
 * The render side of the light-time axis (#1348): a shot's `lightMotions`
 * reaches the `three.js` lights that play them.
 *
 * This is the acceptance's "consumer, not just contract" half. #1339 was a
 * validated artifact with no applier, so the axis is only real if something
 * downstream of `getShot` writes the sampled value; here that is
 * `applyLightMotion` over the id index `buildScene` publishes.
 *
 * Expected values are the artifact's own, converted by the documented units:
 * `range` is `three.js`'s `distance` in metres, and `coneAngle` is a HALF-angle
 * in degrees against `three.js`'s radians, so 40° is `40π/180`. The intensity
 * at the cue comes from the glTF STEP rule (`v_k` for `t_k <= t`) and the
 * midpoint values from linear interpolation at the exact centre of a `[1.2,
 * 2.0]` segment, the same oracles the engine pass is held to.
 *
 * Scenarios:
 *
 * 1. `buildScene` publishes its lights by ID and still adds them as top-level
 *    children in staging order — the mask palette is keyed by that index, so
 *    the id map has to be an addition rather than a reordering.
 * 2. A staged light lands with its authored values (the point light's colour,
 *    intensity, and `distance`; the spot's cone in radians), which is what
 *    makes the "before" of the next scenario a measured value and not an
 *    assumption.
 * 3. At `t = 1.6` the candle reads 0.04 and the segment midpoint colour `(0.5,
 *    0.4, 0.25)`, and the lamp's cone has opened to 70°: the clips drove the
 *    `three.js` lights, on the ids they named.
 * 4. Two halves of one call. A light the host does not resolve is skipped, not
 *    thrown at (the engine already refused a clip naming an unstaged light, so
 *    an unresolved one here is a host that built part of the scene). A light no
 *    clip addresses is written back to its STAGED value, which is where this
 *    helper deliberately differs from `applyObjectMotion`: a light carries its
 *    own rest on the scene, so the viewer's lighting can be a pure function of
 *    scene, clips and time instead of depending on what the previous frame left
 *    behind.
 */
export const test_viewer_apply_light_motion = (): void => {
  const built = buildScene(scene, () => undefined);

  // 1. published by id, still ordered by staging.
  TestValidator.equals(
    "the light index is keyed by id, and the children keep staging order",
    [[...built.lights.keys()], built.scene.children.map((child) => child.type)],
    [
      ["candleGlow", "lamp"],
      ["PointLight", "SpotLight"],
    ],
  );

  // 2. the staged values, the baseline the animation is measured against.
  const candle = built.lights.get("candleGlow") as THREE.PointLight;
  const lamp = built.lights.get("lamp") as THREE.SpotLight;
  TestValidator.predicate(
    "a staged light lands with its authored colour, intensity, range and cone",
    nclose(candle.color.r, 1) &&
      nclose(candle.color.g, 0.8) &&
      nclose(candle.color.b, 0.5) &&
      nclose(candle.intensity, 1.4) &&
      nclose(candle.distance, 4) &&
      nclose(lamp.angle, (40 * Math.PI) / 180),
  );

  // 3. the clip drives them.
  applyLightMotion(
    scene.lights,
    [
      clip(
        "candleOut",
        "/lights/candleGlow/intensity",
        "scalar",
        [0, 1.55, 1.6, 3],
        [1.4, 1.4, 0.04, 0.04],
        "step",
      ),
      clip(
        "candleCools",
        "/lights/candleGlow/color",
        "vec3",
        [1.2, 2],
        [1, 0.8, 0.5, 0, 0, 0],
        "linear",
      ),
      clip(
        "lampOpens",
        "/lights/lamp/coneAngle",
        "scalar",
        [1.2, 2],
        [40, 100],
        "linear",
      ),
    ],
    1.6,
    (id) => built.lights.get(id),
  );
  TestValidator.predicate(
    "the candle dims at the cue and the lamp's cone opens, in three.js units",
    nclose(candle.intensity, 0.04) &&
      nclose(candle.color.r, 0.5) &&
      nclose(candle.color.g, 0.4) &&
      nclose(candle.color.b, 0.25) &&
      nclose(lamp.angle, (70 * Math.PI) / 180),
  );

  // 4. an unresolved light is skipped, not thrown at.
  applyLightMotion(
    scene.lights,
    [
      clip(
        "candleRelight",
        "/lights/candleGlow/intensity",
        "scalar",
        [0, 3],
        [2.5, 2.5],
        "step",
      ),
    ],
    1.6,
    (id) => (id === "candleGlow" ? undefined : built.lights.get(id)),
  );
  TestValidator.predicate(
    "the unresolved light is skipped, and the un-animated one returns to staged",
    nclose(candle.intensity, 0.04) && nclose(lamp.angle, (40 * Math.PI) / 180),
  );
};
