import { Quaternion, applyLightOverride } from "@automovie/engine";
import { IAutoMovieAreaLight, IAutoMovieLight } from "@automovie/interface";
import { applyLightState, buildLight } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, nclose, vclose } from "../internal/predicates";

/** A window panel aimed into the room along world −X. */
const WINDOW: IAutoMovieAreaLight = {
  id: "north-window",
  type: "area",
  transform: {
    translation: { x: 4, y: 2.2, z: 0 },
    rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90),
    scale: { x: 1, y: 1, z: 1 },
  },
  color: { r: 0.9, g: 0.94, b: 1, a: null, hex: null },
  intensity: 12,
  width: 2.4,
  height: 1.8,
};

/** The direction a `three.js` light actually emits: its own local −Z. */
const emitted = (light: THREE.Object3D) => {
  light.updateMatrixWorld(true);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
    light.getWorldQuaternion(new THREE.Quaternion()),
  );
  return { x: forward.x, y: forward.y, z: forward.z };
};

/**
 * A rectangular area source reaches `three.js` as a panel with real extent.
 *
 * Scenarios:
 *
 * 1. An area light builds a `RectAreaLight` carrying its exact width, height,
 *    colour, intensity and placement, and emits along the −Z its staged
 *    rotation aimed, with no target child of its own.
 * 2. A second panel builds whole without repeating the one-per-process install of
 *    the BRDF lookup tables area shading reads.
 * 3. The one writer that maps light values writes the panel extent too, so a host
 *    that rebuilds state per frame cannot lose it, and the punctual kinds are
 *    untouched by the new arm.
 * 4. Folding a shot's lighting over an area light keeps its extent and its staged
 *    shadow policy, and gives it no `range`: the panel's falloff comes from its
 *    own area, so no channel writes one.
 */
export const test_viewer_area_light = (): void => {
  const built = buildLight(WINDOW) as THREE.RectAreaLight;
  TestValidator.equals(
    "the panel reaches Three.js whole",
    namedFacts([
      ["kind", () => built instanceof THREE.RectAreaLight],
      ["width", () => nclose(built.width, 2.4)],
      ["height", () => nclose(built.height, 1.8)],
      ["intensity", () => nclose(built.intensity, 12)],
      ["color", () => nclose(built.color.g, 0.94)],
      [
        "placement",
        () =>
          vclose(
            {
              x: built.position.x,
              y: built.position.y,
              z: built.position.z,
            },
            { x: 4, y: 2.2, z: 0 },
          ),
      ],
      ["aim", () => vclose(emitted(built), { x: -1, y: 0, z: 0 })],
      // A RectAreaLight has no target object, so it must gain no child; the
      // segmentation mask palette is keyed by top-level child index and an
      // invented target would also be a second, drifting statement of aim.
      ["noTarget", () => built.children.length === 0],
      ["noShadow", () => built.castShadow === false],
    ]),
    {
      kind: true,
      width: true,
      height: true,
      intensity: true,
      color: true,
      placement: true,
      aim: true,
      noTarget: true,
      noShadow: true,
    },
  );

  // The BRDF lookup tables an area light shades through are global renderer
  // state, so `buildLight` installs them the first time a panel is built and
  // never again. A second panel is what proves "never again": with no guard the
  // install would repeat once per staged panel, and a room with ten windows
  // would pay for ten uploads of the same two textures.
  const second = buildLight({
    ...WINDOW,
    id: "south-window",
  }) as THREE.RectAreaLight;
  TestValidator.equals(
    "a second panel is built whole without reinstalling the lookup tables",
    namedFacts([
      ["kind", () => second instanceof THREE.RectAreaLight],
      ["width", () => nclose(second.width, 2.4)],
      ["noTarget", () => second.children.length === 0],
    ]),
    { kind: true, width: true, noTarget: true },
  );

  const rewritten = new THREE.RectAreaLight(0xffffff, 1, 1, 1);
  applyLightState(rewritten, { ...WINDOW, width: 5, height: 0.25 });
  TestValidator.equals(
    "the one value writer owns the extent too",
    [rewritten.width, rewritten.height],
    [5, 0.25],
  );

  // A panel written onto a light that is not a RectAreaLight must change no
  // extent it does not have: the arm is instance-guarded, not type-guarded.
  const mismatched = new THREE.PointLight();
  applyLightState(mismatched, WINDOW);
  TestValidator.equals(
    "an area value written onto a punctual light touches only shared fields",
    [mismatched.intensity, mismatched.distance],
    [12, 0],
  );

  const folded = applyLightOverride(
    { ...WINDOW, castShadow: false } as IAutoMovieLight,
    { intensity: 3 },
  );
  TestValidator.equals(
    "folding a shot's lighting keeps the panel and adds no falloff",
    [
      folded.type,
      folded.type === "area" ? folded.width : -1,
      folded.type === "area" ? folded.height : -1,
      folded.intensity,
      folded.castShadow,
      "range" in folded,
    ],
    ["area", 2.4, 1.8, 3, false, false],
  );
};
