import { IAutoMovieSpace } from "@automovie/interface";
import {
  SPACE_GROUP_NAME,
  applyAutoMovieShadowParticipation,
  buildModel,
  buildScene,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

const FLOOR_POLYGON = [
  { x: -2, y: 0, z: -1 },
  { x: 2, y: 0, z: -1 },
  { x: 2, y: 0, z: 1 },
  { x: -2, y: 0, z: 1 },
];

const SPACE: IAutoMovieSpace = {
  id: "space-1",
  surfaces: [{ id: "floor", kind: "floor", polygon: FLOOR_POLYGON }],
  walkable: ["floor"],
};

const sceneOf = () =>
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
      lights: [
        {
          id: "sun",
          type: "directional",
          transform: IDENTITY_TRANSFORM,
          color: { r: 1, g: 1, b: 1, a: null, hex: null },
          intensity: 1,
          castShadow: true,
        },
      ],
      space: SPACE,
    },
    () => buildModel({ ...createModel(), id: "model-a" }),
  ).scene;

/** Every mesh under one object, in traversal order. */
const meshesUnder = (root: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh === true) out.push(object as THREE.Mesh);
  });
  return out;
};

/**
 * A built scene says which objects cast a shadow and which receive one.
 *
 * Every other link of the chain was already built and none of them produced a
 * shadow. `stageScene` validates a light's `castShadow` and refuses shadow
 * settings without it; the render inventory counts `shadowMaps` as
 * `casters.length` and a render budget constrains that count; the scaffold's
 * own example declares `shadows: { enabled: true, type: "pcfSoft" }`;
 * `buildLight` applies the flag and the entire shadow camera — map size, bias,
 * normal bias, near and far; `applySceneEnvironment` enables
 * `renderer.shadowMap` from the scene's declaration and restores the prior
 * state afterwards. `receiveShadow` appeared nowhere in the repository, and
 * `castShadow` only ever on a light. `three.js` needs an enabled map, a casting
 * light **and** participating geometry, so every production that declared a
 * caster rendered none.
 *
 * The absence does not look like one. A `#1954` benchmark authored a fascia and
 * soffit band with a deliberate dark recess above the wall; the darkening reads
 * as a shadow in every captured frame and is nothing but geometry and material
 * response to light direction. Building the appearance out of geometry is what
 * an author reaches for when the mechanism is missing and no gate says so.
 *
 * Scenarios:
 *
 * 1. A model's parts both cast and receive. They are the solids in the scene,
 *    and a solid that occludes nothing is the defect this closes.
 * 2. A standable surface receives and does **not** cast. The requirement asks
 *    for caster and receiver to be distinguished rather than blanket-enabled,
 *    and this is the one place the product knows the difference: a support
 *    patch is a planar stand-in for ground with no volume to cast from, and a
 *    flat patch casting onto its own plane yields depth acne, not a shadow.
 * 3. Non-mesh renderables are untouched. A grid helper, a line, a point cloud
 *    and a sprite carry the same `castShadow` field and mean nothing by it, so
 *    a rule that set every `Object3D` would silently claim they participate.
 * 4. The pass is idempotent and reapplicable by a host that assembles its own
 *    graph — the playground's film page, which is what the offline renderer
 *    captures. Running it twice changes nothing, and running it on a graph
 *    built elsewhere reaches the meshes added after `buildScene` returned.
 */
export const test_viewer_shadow_participation = (): void => {
  const scene = sceneOf();
  const ground = scene.getObjectByName(SPACE_GROUP_NAME)!;
  const groundMeshes = meshesUnder(ground);
  const nodeMeshes = meshesUnder(scene.getObjectByName("node-a")!);

  TestValidator.equals(
    "solids cast and receive while a support patch only receives",
    namedFacts([
      ["the model contributed meshes", () => nodeMeshes.length > 0],
      [
        "and every one of them casts",
        () => nodeMeshes.every((mesh) => mesh.castShadow === true),
      ],
      [
        "and receives",
        () => nodeMeshes.every((mesh) => mesh.receiveShadow === true),
      ],
      ["the space contributed a patch", () => groundMeshes.length > 0],
      // The whole distinction in one assertion. A blanket rule passes every
      // other fact in this case and fails this one.
      [
        "which receives",
        () => groundMeshes.every((mesh) => mesh.receiveShadow === true),
      ],
      [
        "and casts nothing",
        () => groundMeshes.every((mesh) => mesh.castShadow === false),
      ],
    ]),
    {
      "the model contributed meshes": true,
      "and every one of them casts": true,
      "and receives": true,
      "the space contributed a patch": true,
      "which receives": true,
      "and casts nothing": true,
    },
  );

  const grid = new THREE.GridHelper(10, 10);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    ]),
    new THREE.LineBasicMaterial(),
  );
  const points = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1, 0)]),
    new THREE.PointsMaterial(),
  );
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  const late = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial(),
  );
  scene.add(grid, line, points, sprite, late);

  const before = nodeMeshes.map(
    (mesh) => `${String(mesh.castShadow)}/${String(mesh.receiveShadow)}`,
  );
  applyAutoMovieShadowParticipation(scene);
  const after = nodeMeshes.map(
    (mesh) => `${String(mesh.castShadow)}/${String(mesh.receiveShadow)}`,
  );

  TestValidator.equals(
    "non-mesh renderables stay out of it, and a second pass is a no-op",
    namedFacts([
      [
        "a grid, line, point cloud and sprite neither cast nor receive",
        () =>
          [grid, line, points, sprite].every(
            (object) =>
              object.castShadow === false && object.receiveShadow === false,
          ),
      ],
      // A host assembling its own graph adds meshes after `buildScene` has
      // returned, so the pass has to be callable rather than only internal.
      ["a mesh added afterwards casts", () => late.castShadow === true],
      ["and receives", () => late.receiveShadow === true],
      [
        "and the second pass changed nothing",
        () => after.join() === before.join(),
      ],
    ]),
    {
      "a grid, line, point cloud and sprite neither cast nor receive": true,
      "a mesh added afterwards casts": true,
      "and receives": true,
      "and the second pass changed nothing": true,
    },
  );
};
