import { Quaternion, resolveShotLighting } from "@automovie/engine";
import {
  IAutoMovieClip,
  IAutoMovieLight,
  IAutoMovieQuaternion,
  IAutoMovieScene,
  IAutoMovieVector3,
} from "@automovie/interface";
import { applyLightMotion, buildLight, buildScene } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, vclose } from "../internal/predicates";

const keyed = (q: IAutoMovieQuaternion): number[] => [q.x, q.y, q.z, q.w];

const aboutY = (deg: number): IAutoMovieQuaternion =>
  Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, deg);

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [],
  cameras: [],
  lights: [
    {
      id: "lamp",
      type: "spot",
      transform: {
        translation: { x: 2, y: 4, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      color: { r: 1, g: 1, b: 1, a: null, hex: null },
      intensity: 2,
      range: 10,
      coneAngle: 40,
    },
  ],
  space: null,
};

/** The lamp swinging a quarter turn about Y across a four-second beat. */
const swing: IAutoMovieClip = {
  id: "lampSwings",
  name: null,
  duration: 4,
  loop: false,
  tracks: [
    {
      channel: {
        kind: "pointer",
        pointer: "/lights/lamp/rotation",
        valueType: "quaternion",
      },
      times: [0, 4],
      values: [...keyed(aboutY(0)), ...keyed(aboutY(90))],
      interpolation: "linear",
    },
  ],
};

/** The artifact's own direction: the light's local −Z carried by its rotation. */
const declaredDirection = (light: IAutoMovieLight): IAutoMovieVector3 =>
  Quaternion.rotateVector(light.transform.rotation, { x: 0, y: 0, z: -1 });

/**
 * The direction a `three.js` light actually shines: from where it stands toward
 * the target it aims at, which is the only thing the renderer reads.
 */
const renderedDirection = (light: THREE.Light): IAutoMovieVector3 => {
  const aimed = light as THREE.SpotLight;
  aimed.updateMatrixWorld(true);
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  aimed.getWorldPosition(from);
  aimed.target.getWorldPosition(to);
  const direction = to.sub(from).normalize();
  return { x: direction.x, y: direction.y, z: direction.z };
};

/** The engine's resolved lamp at `seconds`. */
const resolvedAt = (seconds: number): IAutoMovieLight =>
  resolveShotLighting({ lights: scene.lights, clips: [swing], seconds })[0]!;

/**
 * Where the swing's own two keys put the lamp halfway along, arrived at without
 * the engine.
 *
 * The comparisons above hold the rendered direction against the direction the
 * ENGINE resolved, so a resolve that read the clip wrongly would move both
 * sides of them together. This one reads the keyframes straight out of the clip
 * and interpolates them with `three.js`' own quaternion math, which is a second
 * arithmetic over the same declaration rather than a second call into the first
 * one.
 */
const keyedMidpointDirection = (): IAutoMovieVector3 => {
  const values = swing.tracks[0]!.values;
  const midpoint = new THREE.Quaternion()
    .fromArray(values.slice(0, 4))
    .slerp(new THREE.Quaternion().fromArray(values.slice(4, 8)), 0.5);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(midpoint);
  return { x: direction.x, y: direction.y, z: direction.z };
};

/**
 * The viewer and the renderer derive the SAME direction, at build time and at
 * every frame after it.
 *
 * Both hosts drive lighting through one seam. The viewer and the scaffold shot
 * runtime the render package captures through (`applyLightMotion` at
 * `packages/template/scaffold/viewer/src/shotRuntime.ts`) each call the same helper
 * with the scene's lights, the shot's clips and the frame's time, and that
 * helper resolves through the engine and writes through one `applyLightState`.
 * The parity risk is therefore not between two packages but between the two
 * PATHS every host takes: a light is placed once when the scene is built and
 * written again on every frame. While those were different writers — the build
 * applied the transform and the per-frame write did not — a light could only
 * ever face where it was staged, which is the defect this pins closed.
 *
 * `three.js` does not shine an aimed light along its quaternion; it shines from
 * its position toward its `target`, so the rendered direction is measured the
 * way the renderer actually computes it, from world positions, and compared
 * against the artifact's own local −Z carried by the resolved rotation.
 * Anything that agreed on the quaternion but disagreed on the aim would still
 * be caught.
 *
 * Scenarios:
 *
 * 1. A staged light built with `buildLight` alone already shines where the
 *    artifact says, so the build path needs no animation to be correct.
 * 2. At the start, the midpoint and the end of the swing, the direction the
 *    `three.js` light shines equals the direction the engine resolved — the
 *    frame follows the declaration rather than the staging.
 * 3. The frame is right, not merely self-consistent: the animated lamp's direction
 *    is what `three.js`' own interpolation of the clip's two keys gives, so
 *    nothing in the engine is on both sides of the comparison. A
 *    build-against-animate check would not say this — both paths reduce to one
 *    `applyLightState` call, and a resolve reading the clip wrongly would carry
 *    them together.
 */
export const test_viewer_light_transform_parity = (): void => {
  // 1. the build path alone is already correct.
  const staged = buildLight(scene.lights[0]!);
  TestValidator.predicate(
    "a staged light shines along the direction its artifact declares",
    vclose(renderedDirection(staged), declaredDirection(scene.lights[0]!)),
  );

  // 2. the frame follows the declaration, at three instants.
  const built = buildScene(scene, () => undefined);
  const lamp = built.lights.get("lamp")!;
  const parityAt = (seconds: number): boolean => {
    applyLightMotion(scene.lights, [swing], seconds, (id) =>
      built.lights.get(id),
    );
    return vclose(
      renderedDirection(lamp),
      declaredDirection(resolvedAt(seconds)),
    );
  };
  TestValidator.equals(
    "the rendered direction equals the resolved direction at every instant",
    namedFacts([
      ["atTheStart", () => parityAt(0)],
      ["atTheMidpoint", () => parityAt(2)],
      ["atTheEnd", () => parityAt(4)],
    ]),
    { atTheStart: true, atTheMidpoint: true, atTheEnd: true },
  );

  // 3. the animated frame against arithmetic the engine took no part in.
  applyLightMotion(scene.lights, [swing], 2, (id) => built.lights.get(id));
  TestValidator.predicate(
    "the animated lamp shines where the clip's own keys put it, interpolated independently",
    vclose(renderedDirection(lamp), keyedMidpointDirection()),
  );
};
