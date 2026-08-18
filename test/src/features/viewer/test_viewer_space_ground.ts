import { IAutoMovieSpace } from "@automovie/interface";
import {
  SPACE_GROUP_NAME,
  applyRenderMode,
  buildModel,
  buildScene,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { namedFacts, nclose, vclose } from "../internal/predicates";

const FLOOR_POLYGON = [
  { x: -2, y: 0, z: -1 },
  { x: 2, y: 0, z: -1 },
  { x: 2, y: 0, z: 1 },
  { x: -2, y: 0, z: 1 },
];

const spaceOf = (surfaces: IAutoMovieSpace["surfaces"]): IAutoMovieSpace => ({
  id: "space-1",
  surfaces,
  walkable: surfaces.map((surface) => surface.id),
});

const sceneOf = (space: IAutoMovieSpace | null | undefined) =>
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
        },
      ],
      space,
    },
    () => buildModel({ ...createModel(), id: "model-a" }),
  );

/** Every triangle's vertices, read back off the built geometry. */
const trianglesOf = (mesh: THREE.Mesh): THREE.Vector3[][] => {
  const position = mesh.geometry.getAttribute("position");
  const index = mesh.geometry.getIndex()!;
  const out: THREE.Vector3[][] = [];
  for (let i = 0; i < index.count; i += 3)
    out.push(
      [0, 1, 2].map((k) =>
        new THREE.Vector3().fromBufferAttribute(position, index.getX(i + k)),
      ),
    );
  return out;
};

/** The right-hand face normal of one triangle: the winding, made numeric. */
const faceNormal = (triangle: THREE.Vector3[]): THREE.Vector3 =>
  new THREE.Vector3()
    .subVectors(triangle[1]!, triangle[0]!)
    .cross(new THREE.Vector3().subVectors(triangle[2]!, triangle[0]!))
    .normalize();

/**
 * A scene's `space` is drawn (#1173). The surfaces were already the engine's
 * semantic ground while nothing rendered them, so a depth or mask pass of a
 * staged scene showed actors over a void: the only ground anywhere was a
 * `GridHelper`, and a grid is a `LineSegments` that every structural pass hides
 * first (#1226). Building the surfaces as real meshes is the whole fix: the
 * passes collect geometry as `traverse` ∩ `isMesh`, so the ground joins them
 * with no pass-side change.
 *
 * Scenarios:
 *
 * 1. A one-floor space adds a `__automovie_space` group holding one mesh named for
 *    the surface, appended AFTER the nodes and lights so the mask palette's
 *    top-level child indexing leaves every node's color where it was.
 * 2. The floor faces UP: its four-vertex footprint fans into two triangles, and
 *    both right-hand face normals are +Y: the winding a single-sided override
 *    material needs in order to draw at all (the counter-clockwise XZ hull fans
 *    to −Y, so the fan is deliberately reversed).
 * 3. A ramp lifts each vertex to its own interpolated height: over a 2 m axis
 *    climbing 1 m, every vertex sits at `x / 2` and every face normal is the
 *    hand-computed plane normal `(-1, 2, 0)/√5`.
 * 4. Heightfield relief is tessellated at its internal lattice, not flattened to
 *    the footprint corners.
 * 5. A collinear footprint encloses no area and contributes no mesh, so a
 *    degenerate surface never reaches the GPU as invalid geometry.
 * 6. Both sides of the absent-space branch: `null` and an omitted field add no
 *    group, leaving the pre-space scene byte-for-byte as it was.
 * 7. A structural pass really does pick the ground up: the depth override swaps
 *    the ground mesh's material along with the actor's, which is exactly what
 *    the hidden grid never allowed.
 */
export const test_viewer_space_ground = (): void => {
  // 1. the group, its placement, and its naming.
  const floor = sceneOf(
    spaceOf([
      {
        id: "floor",
        kind: "floor",
        polygon: FLOOR_POLYGON,
        anchor: { x: 0, y: 0.5, z: 0 },
        rampTo: null,
      },
    ]),
  );
  // A node group now carries its own scene id, so this reads the ordering it
  // always meant to pin and additionally proves the node is addressable by
  // name rather than only by its position among the children.
  TestValidator.equals(
    "the space group is appended after the nodes and lights",
    floor.scene.children.map((child) => child.name),
    ["node-a", "", SPACE_GROUP_NAME],
  );
  const ground = floor.scene.children[2]!;
  TestValidator.equals(
    "one mesh per surface, named for it",
    ground.children.map((child) => child.name),
    ["floor"],
  );

  // 2. the winding: two upward triangles at the anchor height.
  const triangles = trianglesOf(ground.children[0] as THREE.Mesh);
  TestValidator.equals("a square fans into two triangles", triangles.length, 2);
  TestValidator.predicate(
    "every floor triangle faces up at the anchor height",
    triangles.every(
      (triangle) =>
        vclose(faceNormal(triangle), { x: 0, y: 1, z: 0 }) &&
        triangle.every((vertex) => nclose(vertex.y, 0.5)),
    ),
  );

  // 3. the ramp: height interpolated per vertex, one plane normal.
  const ramp = sceneOf(
    spaceOf([
      {
        id: "ramp",
        kind: "ramp",
        polygon: [
          { x: 0, y: 0, z: 0 },
          { x: 2, y: 0, z: 0 },
          { x: 2, y: 0, z: 2 },
          { x: 0, y: 0, z: 2 },
        ],
        anchor: { x: 0, y: 0, z: 0 },
        rampTo: { x: 2, y: 1, z: 0 },
      },
    ]),
  );
  const rampTriangles = trianglesOf(
    ramp.scene.children[2]!.children[0] as THREE.Mesh,
  );
  const slope = Math.sqrt(5);
  TestValidator.predicate(
    "a ramp's vertices ride its plane, normal (-1, 2, 0)/sqrt(5)",
    rampTriangles.every(
      (triangle) =>
        vclose(faceNormal(triangle), {
          x: -1 / slope,
          y: 2 / slope,
          z: 0,
        }) && triangle.every((vertex) => nclose(vertex.y, vertex.x / 2)),
    ),
  );

  // 4. heightfield relief reaches an internal viewer vertex.
  const relief = sceneOf(
    spaceOf([
      {
        id: "relief",
        kind: "floor",
        polygon: [
          { x: 0, y: 0, z: 0 },
          { x: 2, y: 0, z: 0 },
          { x: 2, y: 0, z: 2 },
          { x: 0, y: 0, z: 2 },
        ],
        height: {
          kind: "heightfield",
          originX: 0,
          originZ: 0,
          spacingX: 1,
          spacingZ: 1,
          columns: 3,
          rows: 3,
          samples: [0, 0, 0, 0, 2, 0, 0, 0, 0],
        },
      },
    ]),
  );
  const reliefPosition = (
    relief.scene.children[2]!.children[0] as THREE.Mesh
  ).geometry.getAttribute("position");
  TestValidator.predicate(
    "the visible heightfield contains its raised center sample",
    Array.from({ length: reliefPosition.count }, (_, index) => index).some(
      (index) =>
        nclose(reliefPosition.getX(index), 1) &&
        nclose(reliefPosition.getY(index), 2) &&
        nclose(reliefPosition.getZ(index), 1),
    ),
  );

  // 5. a degenerate footprint contributes nothing.
  const collinear = sceneOf(
    spaceOf([
      {
        id: "line",
        kind: "platform",
        polygon: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 2, y: 0, z: 0 },
        ],
        anchor: { x: 0, y: 0, z: 0 },
        rampTo: null,
      },
    ]),
  );
  TestValidator.equals(
    "a zero-area footprint builds no mesh",
    collinear.scene.children[2]!.children.length,
    0,
  );

  // 6. both sides of the absent-space branch.
  TestValidator.equals(
    "a null space adds no group",
    sceneOf(null).scene.children.length,
    2,
  );
  TestValidator.equals(
    "an omitted space adds no group",
    sceneOf(undefined).scene.children.length,
    2,
  );

  // 7. the ground reaches a structural pass like any other geometry.
  const groundMesh = ground.children[0] as THREE.Mesh;
  const beauty = groundMesh.material;
  const handle = applyRenderMode(floor.scene, "depth");
  TestValidator.predicate(
    "the depth pass overrides the ground's material too",
    groundMesh.material !== beauty,
  );
  handle.restore();
  TestValidator.predicate(
    "restoring puts the ground's beauty material back",
    groundMesh.material === beauty,
  );
};

/**
 * The ground stand-in yields to an authored floor on the same plane.
 *
 * A production that builds its own slab and also declares the space standing on
 * it puts two surfaces at one height, and a `#1954` benchmark photographed the
 * result: a stepped diagonal seam across a living-room floor. Measured from the
 * compiled artifact rather than from the frame — the storey-owned slab spans
 * −0.2 to 0.0 so its **top face is exactly Y = 0.0**, and the room's walkable
 * polygon is **Y = 0**. The upper storey repeated it at 3.0 against 3.
 *
 * Neither surface is wrong and the renderer has no principled way to order two
 * coplanar faces, so the order is stated: the stand-in is biased away from the
 * eye and the authored floor wins.
 *
 * A bias rather than a suppression. This group exists for the scene that has no
 * floor of its own, and must still draw when nothing else is there; removing it
 * where a slab exists would need the viewer to decide which authored elements
 * count as floor, which is a judgement it has no basis to make.
 *
 * Scenarios:
 *
 * 1. Every standable surface carries a polygon offset, and it is **positive** —
 *    the sign is the whole assertion, because a negative one pulls the stand-in
 *    forward and hides the authored floor behind it, which is the same defect
 *    with the two surfaces swapped.
 * 2. A model's own meshes carry no offset, so only the stand-in yields. A
 *    blanket bias would order nothing, since two biased surfaces tie again.
 */
export const test_viewer_space_ground_offset = (): void => {
  const { scene } = sceneOf(
    spaceOf([{ id: "floor", kind: "floor", polygon: FLOOR_POLYGON }]),
  );
  const patches: THREE.MeshStandardMaterial[] = [];
  scene.getObjectByName(SPACE_GROUP_NAME)!.traverse((object) => {
    if ((object as THREE.Mesh).isMesh === true)
      patches.push(
        (object as THREE.Mesh).material as THREE.MeshStandardMaterial,
      );
  });
  const modelMaterials: THREE.Material[] = [];
  scene.getObjectByName("node-a")!.traverse((object) => {
    if ((object as THREE.Mesh).isMesh === true)
      modelMaterials.push((object as THREE.Mesh).material as THREE.Material);
  });

  TestValidator.equals(
    "the ground stand-in is biased behind an authored floor, and nothing else is",
    namedFacts([
      ["the space contributed a patch", () => patches.length > 0],
      [
        "every patch is offset",
        () => patches.every((m) => m.polygonOffset === true),
      ],
      // The sign is the assertion. Reversed, the stand-in wins the tie and
      // hides the floor a production actually authored.
      [
        "away from the eye rather than toward it",
        () =>
          patches.every(
            (m) => m.polygonOffsetFactor > 0 && m.polygonOffsetUnits > 0,
          ),
      ],
      ["the model contributed meshes", () => modelMaterials.length > 0],
      [
        "and none of them is offset",
        () =>
          modelMaterials.every(
            (m) => (m as THREE.MeshStandardMaterial).polygonOffset !== true,
          ),
      ],
    ]),
    {
      "the space contributed a patch": true,
      "every patch is offset": true,
      "away from the eye rather than toward it": true,
      "the model contributed meshes": true,
      "and none of them is offset": true,
    },
  );
};
