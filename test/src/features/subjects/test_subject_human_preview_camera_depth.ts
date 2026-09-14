import { createHumanPreviewCamera } from "@automovie/playground/src/human/previewScene";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

/**
 * Fitting includes the complete three-dimensional face and hair envelope for
 * every anatomical orbit preset, including a narrow viewport and long hair.
 *
 * Scenarios:
 * 1. All eight translated box corners remain inside the perspective frustum
 *    at front, both obliques, both profiles and back after fitting.
 * 2. Portrait/wide aspects and optical zoom participate in fitting; the orbit
 *    distance cap and far plane cannot clip an otherwise valid deep model.
 * 3. Camera operations leave the authored geometry and placement unchanged.
 */
export const test_subject_human_preview_camera_depth = (): void => {
  for (const dimensions of [
    [0.2, 0.4, 0.1],
    [0.14, 0.2, 0.5],
    [0.14, 0.2, 2.5],
    [0.002, 0.004, 0.001],
  ]) {
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...dimensions),
      new THREE.MeshStandardMaterial(),
    );
    mesh.position.set(0.3, -0.2, 0.1);
    model.add(mesh);
    const source = Array.from(mesh.geometry.attributes.position.array);
    for (const aspect of [0.3, 1, 2])
      for (const zoom of [1, 2]) {
        const camera = new THREE.PerspectiveCamera(30, aspect, 0.01, 10);
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        const orbit = {
          target: new THREE.Vector3(),
          minDistance: 0.12,
          maxDistance: 2,
          update: () => {
            const delta = camera.position.clone().sub(orbit.target);
            delta.clampLength(orbit.minDistance, orbit.maxDistance);
            camera.position.copy(orbit.target).add(delta);
            camera.lookAt(orbit.target);
            camera.updateMatrixWorld(true);
          },
        };
        const controls = createHumanPreviewCamera({
          camera,
          orbit,
          model: () => model,
          setSize: () => {},
        });
        controls.fitView();
        for (const angle of [0, 45, -45, 90, -90, 180]) {
          controls.cameraView(angle);
          const corners = [-1, 1].flatMap((x) =>
            [-1, 1].flatMap((y) =>
              [-1, 1].map((z) =>
                new THREE.Vector3(
                  (x * dimensions[0]) / 2,
                  (y * dimensions[1]) / 2,
                  (z * dimensions[2]) / 2,
                )
                  .add(mesh.position)
                  .project(camera),
              ),
            ),
          );
          TestValidator.equals("complete corner population", corners.length, 8);
          TestValidator.predicate(
            `full depth at ${angle} degrees, aspect ${aspect}, zoom ${zoom}`,
            corners.every((point) =>
              point
                .toArray()
                .every(
                  (value) => Number.isFinite(value) && Math.abs(value) < 1,
                ),
            ),
          );
        }
      }
    TestValidator.equals(
      "view fitting preserves authored geometry",
      Array.from(mesh.geometry.attributes.position.array),
      source,
    );
    TestValidator.equals(
      "view fitting preserves placement",
      mesh.position.toArray(),
      [0.3, -0.2, 0.1],
    );
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
};
