import { createHumanPreviewCamera } from "@automovie/playground/src/human/previewScene";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { nclose } from "../internal/predicates";

/**
 * Camera fitting and anatomical presets operate on visible geometry, not saved
 * identity, and stay finite when a responsive viewport temporarily collapses.
 *
 * Scenarios:
 * 1. Fit with no current model is a no-op; side presets orbit one fixed target.
 * 2. Fitting a translated box targets its centre and keeps its extents in view.
 * 3. Zero-width/height and ordinary resizes retain a finite projection and fit.
 */
export const test_subject_human_preview_camera = (): void => {
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  const target = new THREE.Vector3(1, 2, 3);
  const state: { model?: THREE.Group } = {};
  const sizes: number[][] = [];
  const controls = createHumanPreviewCamera({
    camera,
    orbit: { target, update: () => camera.lookAt(target) },
    model: () => state.model,
    setSize: (width, height) => {
      sizes.push([width, height]);
    },
  });
  controls.fitView();
  TestValidator.predicate(
    "no current group does not move camera",
    camera.position.length() === 0,
  );
  controls.cameraView(90);
  TestValidator.predicate(
    "left view orbits positive X",
    camera.position.x > target.x && nclose(camera.position.z, target.z),
  );
  const distance = camera.position.distanceTo(target);
  controls.cameraView(-90);
  TestValidator.predicate(
    "right view orbits negative X",
    camera.position.x < target.x && nclose(camera.position.z, target.z),
  );
  TestValidator.predicate(
    "presets preserve distance",
    nclose(camera.position.distanceTo(target), distance),
  );
  const model = new THREE.Group();
  state.model = model;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.4, 0.1),
    new THREE.MeshStandardMaterial(),
  );
  mesh.position.set(0.1, 0.2, -0.1);
  model.add(mesh);
  const source = Array.from(mesh.geometry.attributes.position.array);
  controls.fitView();
  TestValidator.predicate(
    "actual geometry centre",
    [target.x, target.y, target.z].every((value, i) =>
      nclose(value, [0.1, 0.2, -0.1][i]),
    ),
  );
  TestValidator.predicate(
    "whole height fits",
    camera.position.z - target.z > 0.2 / Math.tan(Math.PI / 12),
  );
  for (const [width, height] of [
    [0, 200],
    [200, 0],
    [0, 0],
    [800, 400],
  ]) {
    controls.resize(width, height);
    controls.fitView();
    TestValidator.predicate(
      "finite camera and projection",
      [...camera.position.toArray(), ...camera.projectionMatrix.elements].every(
        Number.isFinite,
      ),
    );
  }
  TestValidator.equals("actual viewport dimensions reach renderer", sizes, [
    [0, 200],
    [200, 0],
    [0, 0],
    [800, 400],
  ]);
  TestValidator.predicate("ordinary aspect", nclose(camera.aspect, 2));
  TestValidator.predicate(
    "view changes preserve local geometry",
    Array.from(mesh.geometry.attributes.position.array).every((value, i) =>
      nclose(value, source[i]),
    ),
  );
  TestValidator.predicate(
    "view changes preserve authored placement",
    mesh.position
      .toArray()
      .every((value, i) => nclose(value, [0.1, 0.2, -0.1][i])),
  );
  mesh.geometry.dispose();
  mesh.material.dispose();
};
