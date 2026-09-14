import {
  disposeHumanPreview,
  prepareHumanPreview,
} from "@automovie/playground/src/human/previewScene";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

/**
 * Preview policy follows Three.js type flags, not a particular constructor.
 * Scenarios:
 * 1. An independently defined mesh and optical finish receive transmission
 *    policy and disposal even though neither inherits the matching constructor.
 * 2. A standard finish with an unrelated transmission property stays opaque.
 */
export const test_subject_human_preview_type_flags = (): void => {
  class OpticalFinish extends THREE.MeshStandardMaterial {
    readonly isMeshPhysicalMaterial = true;
    transmission = 0.5;
  }
  class MeshPort extends THREE.Object3D {
    readonly isMesh = true;
    geometry = new THREE.BufferGeometry();
    constructor(public material: THREE.Material) {
      super();
    }
  }
  const optical = new OpticalFinish();
  const ordinary = Object.assign(new THREE.MeshStandardMaterial(), {
    transmission: 1,
  });
  const meshes = [new MeshPort(optical), new MeshPort(ordinary)];
  TestValidator.equals(
    "independent mesh constructor",
    meshes[0] instanceof THREE.Mesh,
    false,
  );
  TestValidator.equals(
    "independent optical constructor",
    optical instanceof THREE.MeshPhysicalMaterial,
    false,
  );
  const group = new THREE.Group();
  group.add(...meshes);
  let released = 0;
  for (const mesh of meshes) {
    mesh.geometry.addEventListener("dispose", () => released++);
    mesh.material.addEventListener("dispose", () => released++);
  }
  prepareHumanPreview(group);
  TestValidator.equals(
    "flag distinguishes optical material",
    meshes.map((mesh) => mesh.castShadow),
    [false, true],
  );
  TestValidator.equals(
    "foreign meshes receive shadows",
    meshes.map((mesh) => mesh.receiveShadow),
    [true, true],
  );
  disposeHumanPreview(group);
  TestValidator.equals("foreign resources released", released, 4);
};
