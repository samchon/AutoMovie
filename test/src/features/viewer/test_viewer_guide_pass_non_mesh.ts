import { AutoMovieGuidePass } from "@automovie/interface";
import {
  POSE_OVERLAY_NAME,
  applyRenderMode,
  buildModel,
  buildScene,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";

/** A scene with one mesh node plus every non-mesh renderable class. */
const sceneWithHelpers = () => {
  const objects = new Map([
    ["model-a", buildModel({ ...createModel(), id: "model-a" })],
  ]);
  const { scene } = buildScene(
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
    },
    (id) => objects.get(id),
  );

  const grid = new THREE.GridHelper(10, 10); // LineSegments (isMesh falsy)
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
  scene.add(grid, line, points, sprite);
  return { scene, nonMesh: [grid, line, points, sprite] };
};

const STRUCTURAL: AutoMovieGuidePass[] = [
  "depth",
  "normal",
  "outline",
  "mask",
  "pose",
];

/**
 * A structural guide pass segments only the subject MESH geometry (#1226).
 * Every non-mesh renderable (a grid or other `LineSegments`/`Line` helper,
 * `Points`, a `Sprite`) must be hidden while the pass renders, or it would
 * draw its live beauty material over the pass's black background (a grid
 * reading as "very close" in depth, a non-palette color in mask, a stray line
 * beside the skeleton in pose). Restore makes them visible again; `beauty`
 * never hides them; and the pose pass's own skeleton overlay (itself
 * `LineSegments`, added after the hide) stays visible.
 *
 * Scenarios:
 *
 * 1. Each structural pass hides every non-mesh renderable while it is applied, and
 *    restore returns them all to visible.
 * 2. `beauty` leaves every non-mesh renderable visible (no override at all).
 * 3. The pose pass hides the pre-existing non-mesh renderables yet keeps its own
 *    skeleton overlay visible: the fix hides what was there, not what the pass
 *    draws.
 */
export const test_viewer_guide_pass_non_mesh = (): void => {
  // 1. every structural pass hides non-mesh renderables, restore returns them.
  for (const mode of STRUCTURAL) {
    const { scene, nonMesh } = sceneWithHelpers();
    const handle = applyRenderMode(scene, mode);
    TestValidator.predicate(
      `${mode} hides every non-mesh renderable while applied`,
      nonMesh.every((object) => object.visible === false),
    );
    handle.restore();
    TestValidator.predicate(
      `${mode} restore returns every non-mesh renderable to visible`,
      nonMesh.every((object) => object.visible === true),
    );
  }

  // 2. beauty leaves non-mesh renderables visible.
  {
    const { scene, nonMesh } = sceneWithHelpers();
    const handle = applyRenderMode(scene, "beauty");
    TestValidator.predicate(
      "beauty leaves every non-mesh renderable visible",
      nonMesh.every((object) => object.visible === true),
    );
    handle.restore();
  }

  // 3. pose hides the scene's non-mesh renderables but keeps its own overlay.
  {
    const { scene, nonMesh } = sceneWithHelpers();
    const handle = applyRenderMode(scene, "pose");
    const overlay = scene.getObjectByName(POSE_OVERLAY_NAME);
    if (overlay === undefined) throw new Error("pose overlay must exist");
    TestValidator.predicate(
      "the pre-existing non-mesh renderables are hidden under pose",
      nonMesh.every((object) => object.visible === false),
    );
    TestValidator.predicate(
      "the pose skeleton overlay stays visible with its lines",
      overlay.visible === true &&
        overlay.children.length > 0 &&
        overlay.children.every((child) => child.visible === true),
    );
    handle.restore();
    TestValidator.predicate(
      "pose restore removes the overlay and unhides the non-mesh renderables",
      scene.getObjectByName(POSE_OVERLAY_NAME) === undefined &&
        nonMesh.every((object) => object.visible === true),
    );
  }
};
