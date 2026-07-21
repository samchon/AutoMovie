import { stageScene } from "@automovie/engine";
import {
  IAutoMovieScene,
  IAutoMovieStagingApplication,
  IAutoMovieVector3,
} from "@automovie/interface";
import { buildScene } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { vclose } from "../internal/predicates";

/** Stage a scene carrying exactly the given light placements. */
const stagedWith = (
  lights: IAutoMovieStagingApplication.ILightPlacement[],
): IAutoMovieScene => {
  const staged = stageScene(
    {
      logline: "one lit beat",
      theme: "light",
      cast: [{ node: "hero", character: "the subject", modelRef: null }],
      beats: [{ id: "b1", name: "one", summary: "the beat", durationHint: 1 }],
    },
    {
      plan: "one subject, one camera, and exactly the lights under test",
      scene: { id: "scene-1", name: "a lit set" },
      actors: [{ node: "hero", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 }],
      cameras: [
        {
          node: "cam",
          position: { x: 0, y: 1.5, z: 3 },
          lookAt: { kind: "node", node: "hero" },
          fovDeg: 40,
        },
      ],
      lights,
    },
  );
  if (staged.success === false)
    throw new Error(`staging refused: ${JSON.stringify(staged.violations)}`);
  return staged.scene;
};

/** Build the staged scene through the viewer with placeholder model objects. */
const built = (scene: IAutoMovieScene): THREE.Scene =>
  buildScene(scene, () => ({
    object: new THREE.Group(),
    bones: new Map(),
  })).scene;

const lightsOf = (scene: THREE.Scene): THREE.Light[] => {
  const found: THREE.Light[] = [];
  scene.traverse((object) => {
    if ((object as THREE.Light).isLight === true)
      found.push(object as THREE.Light);
  });
  return found;
};

/**
 * The world-space direction a `three.js` aimed light actually shines, which is
 * `target − position`, never the light's own quaternion.
 */
const shineDirection = (
  light: THREE.DirectionalLight | THREE.SpotLight,
): IAutoMovieVector3 => {
  light.updateMatrixWorld(true);
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  light.getWorldPosition(from);
  light.target.getWorldPosition(to);
  const d = to.sub(from).normalize();
  return { x: d.x, y: d.y, z: d.z };
};

const unit = (v: IAutoMovieVector3): IAutoMovieVector3 => {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};

/**
 * A staged light's authored direction is what lights the frame (#1356).
 *
 * `stage` requires `direction` for the aimed kinds and lowers it into the scene
 * light's `transform.rotation` (`IAutoMovieLight`: "for directional light only
 * the orientation matters"). `three.js` shines a `DirectionalLight`/`SpotLight`
 * from its position toward its `target`, ignoring the quaternion entirely, and
 * the target defaults to the world origin: a staged directional light (lowered
 * to the origin, since only its orientation means anything) came out shining
 * along the ZERO vector, and a spot aimed at the origin from wherever it stood,
 * both while `stage` reported success and the scene validated clean.
 *
 * The oracle is the authored direction itself, read back through the same
 * `target − position` `three.js` uses, so this measures the rendered aim rather
 * than the artifact it came from.
 *
 * Scenarios:
 *
 * 1. A directional light aimed straight down, straight up, and along a diagonal
 *    shines exactly that way, and its shine vector has unit length (the
 *    zero-vector degeneracy cannot recur).
 * 2. A spot light far from the origin shines along its authored direction, not at
 *    the origin: the case whose wrongness the default target used to mask
 *    whenever the subject happened to stand near (0, 0, 0).
 * 3. Negative twin: a `point` light radiates every way, carries no direction by
 *    contract, and gets no aiming target; its position and range survive.
 */
export const test_viewer_light_direction = (): void => {
  // 1. directional, three authored directions
  for (const direction of [
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: -1, y: -2, z: 0.5 },
  ]) {
    const scene = built(
      stagedWith([
        { node: "sun", type: "directional", direction, intensity: 1 },
      ]),
    );
    const light = lightsOf(scene)[0] as THREE.DirectionalLight;
    const shine = shineDirection(light);
    TestValidator.predicate(
      `a directional light shines along ${JSON.stringify(direction)}`,
      vclose(shine, unit(direction), 1e-6),
    );
    TestValidator.predicate(
      `its shine vector has unit length, never the zero vector ${JSON.stringify(direction)}`,
      Math.abs(Math.hypot(shine.x, shine.y, shine.z) - 1) < 1e-6,
    );
  }

  // 2. a spot far from the origin aims where it was told, not at (0, 0, 0)
  const spotDirection = { x: -1, y: -1, z: 0 };
  const spotScene = built(
    stagedWith([
      {
        node: "lamp",
        type: "spot",
        position: { x: 2, y: 3, z: 0 },
        direction: spotDirection,
        intensity: 5,
        coneAngle: 30,
      },
    ]),
  );
  const spot = lightsOf(spotScene)[0] as THREE.SpotLight;
  TestValidator.predicate(
    "a spot light shines along its authored direction, not at the origin",
    vclose(shineDirection(spot), unit(spotDirection), 1e-6),
  );
  // The counter-case that proves the assertion is not vacuous: aiming AT the
  // origin from (2, 3, 0) is a different vector, and it is what the light used
  // to shine along.
  TestValidator.predicate(
    "aiming at the origin would have been a different direction",
    vclose(shineDirection(spot), unit({ x: -2, y: -3, z: 0 }), 1e-6) === false,
  );

  // 3. NEGATIVE TWIN: a point light radiates, so nothing aims it
  const pointScene = built(
    stagedWith([
      {
        node: "candle",
        type: "point",
        position: { x: 1, y: 2, z: -1 },
        intensity: 3,
        range: 8,
      },
    ]),
  );
  const point = lightsOf(pointScene)[0] as THREE.PointLight;
  TestValidator.predicate(
    "a point light keeps its position and range and carries no aiming target",
    point.position.x === 1 &&
      point.position.y === 2 &&
      point.position.z === -1 &&
      point.distance === 8 &&
      point.children.length === 0,
  );
};
