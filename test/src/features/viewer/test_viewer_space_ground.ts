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
import { nclose, vclose } from "../internal/predicates";

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

/** The right-hand face normal of one triangle — the winding, made numeric. */
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
 * first (#1226). Building the surfaces as real meshes is the whole fix — the
 * passes collect geometry as `traverse` ∩ `isMesh`, so the ground joins them
 * with no pass-side change.
 *
 * Scenarios:
 *
 * 1. A one-floor space adds a `__automovie_space` group holding one mesh named for
 *    the surface, appended AFTER the nodes and lights so the mask palette's
 *    top-level child indexing leaves every node's color where it was.
 * 2. The floor faces UP: its four-vertex footprint fans into two triangles, and
 *    both right-hand face normals are +Y — the winding a single-sided override
 *    material needs in order to draw at all (the counter-clockwise XZ hull fans
 *    to −Y, so the fan is deliberately reversed).
 * 3. A ramp lifts each vertex to its own interpolated height: over a 2 m axis
 *    climbing 1 m, every vertex sits at `x / 2` and every face normal is the
 *    hand-computed plane normal `(-1, 2, 0)/√5`.
 * 4. A collinear footprint encloses no area and contributes no mesh, so a
 *    degenerate surface never reaches the GPU as invalid geometry.
 * 5. Both sides of the absent-space branch: `null` and an omitted field add no
 *    group, leaving the pre-space scene byte-for-byte as it was.
 * 6. A structural pass really does pick the ground up — the depth override swaps
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
  TestValidator.equals(
    "the space group is appended after the nodes and lights",
    floor.scene.children.map((child) => child.name),
    ["", "", SPACE_GROUP_NAME],
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

  // 4. a degenerate footprint contributes nothing.
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

  // 5. both sides of the absent-space branch.
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

  // 6. the ground reaches a structural pass like any other geometry.
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
