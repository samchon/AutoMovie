import {
  POSE_OVERLAY_NAME,
  applyRenderMode,
  buildModel,
  buildScene,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";

const buildOneNodeScene = () => {
  const objects = new Map([
    ["model-a", buildModel({ ...createModel(), id: "model-a" })],
  ]);
  return buildScene(
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
};

const meshesOf = (root: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh === true)
      meshes.push(object as THREE.Mesh);
  });
  return meshes;
};

/** Attach a dispose-event spy to a material or geometry; returns the counter. */
const spyDispose = (
  target: THREE.Material | THREE.BufferGeometry,
): { count: number } => {
  const counter = { count: 0 };
  target.addEventListener("dispose", () => {
    counter.count += 1;
  });
  return counter;
};

const materialsOf = (mesh: THREE.Mesh): THREE.Material[] =>
  Array.isArray(mesh.material) ? mesh.material : [mesh.material];

/**
 * Restore() must dispose every resource the override CREATED (exactly once)
 * and never the borrowed originals: a guide-pass render applies and restores
 * once per frame per pass, so an hour of film would otherwise leak tens of
 * thousands of WebGL materials/geometries (#645). Restoring twice is a no-op.
 *
 * Scenarios:
 *
 * 1. `depth`: every created override material is disposed exactly once on restore;
 *    the borrowed originals are never disposed; a second restore() leaves every
 *    count unchanged (idempotence).
 * 2. `outline`: same contract as depth (the other single-material override).
 * 3. `mask`: the created per-node flat materials are disposed exactly once;
 *    originals untouched; the background instance is restored.
 * 4. `pose`: every created line geometry AND the shared line material are disposed
 *    exactly once; the overlay leaves the scene.
 * 5. `beauty`: creates nothing and disposes nothing. Original materials keep a
 *    zero dispose count through apply+restore.
 */
export const test_viewer_render_mode_dispose = (): void => {
  const { scene } = buildOneNodeScene();
  const meshes = meshesOf(scene);
  const originalSpies = meshes.flatMap((mesh) =>
    materialsOf(mesh).map(spyDispose),
  );

  // 1. depth: created disposed once, originals never, restore-twice safe.
  const depth = applyRenderMode(scene, "depth");
  const depthSpies = meshes.flatMap((mesh) =>
    materialsOf(mesh).map(spyDispose),
  );
  depth.restore();
  TestValidator.predicate(
    "depth override materials disposed exactly once",
    depthSpies.every((spy) => spy.count === 1),
  );
  depth.restore();
  TestValidator.predicate(
    "second restore is a no-op (no double dispose)",
    depthSpies.every((spy) => spy.count === 1),
  );

  // 2. outline: same contract.
  const outline = applyRenderMode(scene, "outline");
  const outlineSpies = meshes.flatMap((mesh) =>
    materialsOf(mesh).map(spyDispose),
  );
  outline.restore();
  TestValidator.predicate(
    "outline override materials disposed exactly once",
    outlineSpies.every((spy) => spy.count === 1),
  );

  // 3. mask: created per-node materials disposed once, background restored.
  const background = scene.background;
  const mask = applyRenderMode(scene, "mask");
  const maskSpies = meshes.flatMap((mesh) => materialsOf(mesh).map(spyDispose));
  mask.restore();
  TestValidator.predicate(
    "mask materials disposed exactly once",
    maskSpies.every((spy) => spy.count === 1),
  );
  TestValidator.predicate(
    "mask restores the background instance",
    scene.background === background,
  );

  // 4. pose: line geometries and the shared line material disposed once.
  const pose = applyRenderMode(scene, "pose");
  const overlay = scene.getObjectByName(POSE_OVERLAY_NAME);
  if (overlay === undefined) throw new Error("pose overlay must exist");
  const lines = overlay.children as THREE.Line[];
  TestValidator.predicate("pose drew at least one line", lines.length > 0);
  const geometrySpies = lines.map((line) => spyDispose(line.geometry));
  const lineMaterialSpy = spyDispose(lines[0]!.material as THREE.Material);
  pose.restore();
  TestValidator.predicate(
    "pose line geometries disposed exactly once",
    geometrySpies.every((spy) => spy.count === 1),
  );
  TestValidator.equals(
    "pose shared line material disposed exactly once",
    lineMaterialSpy.count,
    1,
  );
  pose.restore();
  TestValidator.equals(
    "pose second restore does not double-dispose",
    lineMaterialSpy.count,
    1,
  );

  // 5. beauty: nothing created, nothing disposed; originals never disposed
  //    through the whole run.
  const beauty = applyRenderMode(scene, "beauty");
  beauty.restore();
  beauty.restore();
  TestValidator.predicate(
    "borrowed originals were never disposed by any mode",
    originalSpies.every((spy) => spy.count === 0),
  );
};
