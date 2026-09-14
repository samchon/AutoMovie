import {
  disposeHumanPreview,
  prepareHumanPreview,
} from "@automovie/playground/src/human/previewScene";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

/**
 * Masked hair participates in multisample coverage and its shared textures are released.
 * Scenarios:
 * 1. A masked finish enables alpha-to-coverage; an opaque finish does not.
 * 2. Two finishes sharing one texture dispose that texture once. Texture-free
 *    finishes and non-mesh children remain valid inputs.
 */
export const test_subject_human_preview_textures = (): void => {
  const texture = new THREE.Texture();
  let disposed = 0;
  texture.addEventListener("dispose", () => disposed++);
  const masked = new THREE.MeshStandardMaterial({
      map: texture,
      alphaTest: 0.45,
    }),
    opaque = new THREE.MeshStandardMaterial({ map: texture });
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(new THREE.BufferGeometry(), [masked, opaque]),
    new THREE.Object3D(),
  );
  prepareHumanPreview(group);
  TestValidator.equals("masked coverage", masked.alphaToCoverage, true);
  TestValidator.equals("opaque coverage", opaque.alphaToCoverage, false);
  disposeHumanPreview(group);
  TestValidator.equals("one release for shared image", disposed, 1);
};
