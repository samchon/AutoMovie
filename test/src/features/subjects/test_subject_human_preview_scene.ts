import {
  disposeHumanPreview,
  prepareHumanPreview,
} from "@automovie/playground/src/human/previewScene";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

/**
 * Shadow policy follows optical transmission, and discarded preview resources
 * release their geometry and each material without needing a WebGL context.
 *
 * Scenarios:
 * 1. Ordinary, zero-transmission and mixed optical meshes receive correct shadows.
 * 2. Nested non-mesh nodes are unaffected and all owned resources emit disposal.
 */
export const test_subject_human_preview_scene = (): void => {
  const group = new THREE.Group(),
    nested = new THREE.Group();
  const ordinary = new THREE.MeshStandardMaterial();
  const opaqueOptics = new THREE.MeshPhysicalMaterial({ transmission: 0 });
  const clearOptics = new THREE.MeshPhysicalMaterial({ transmission: 1 });
  const surfaces = [
    ordinary,
    opaqueOptics,
    [new THREE.MeshStandardMaterial(), clearOptics],
  ];
  const meshes = surfaces.map(
    (material) => new THREE.Mesh(new THREE.BoxGeometry(), material),
  );
  group.add(nested);
  nested.add(...meshes);
  prepareHumanPreview(group);
  TestValidator.equals(
    "only transmissive mesh stops casting",
    meshes.map((mesh) => mesh.castShadow),
    [true, true, false],
  );
  TestValidator.equals(
    "all meshes receive lighting",
    meshes.map((mesh) => mesh.receiveShadow),
    [true, true, true],
  );
  TestValidator.equals(
    "non-mesh node stays unchanged",
    nested.receiveShadow,
    false,
  );
  let geometries = 0,
    materials = 0;
  for (const mesh of meshes)
    mesh.geometry.addEventListener("dispose", () => {
      geometries++;
    });
  for (const material of surfaces.flat())
    material.addEventListener("dispose", () => {
      materials++;
    });
  disposeHumanPreview(group);
  TestValidator.equals(
    "all owned geometry released",
    geometries,
    meshes.length,
  );
  TestValidator.equals(
    "all owned material entries released",
    materials,
    surfaces.flat().length,
  );
};
