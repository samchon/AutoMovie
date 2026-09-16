import { prepareHumanPreview } from "@automovie/playground/src/human/previewScene";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { throwsError } from "../internal/predicates";

/**
 * Preview sampling uses the available device limit without repeated uploads or
 * changes to the decoded geometry, image payload, alpha cutoff or map binding.
 *
 * Scenarios:
 * 1. Shared colour and normal textures receive one upload at the 16-sample cap.
 * 2. A lower device limit, zero support and the omitted limit retain valid sampling.
 * 3. Invalid limits reject before changing any mesh or texture state.
 */
export const test_subject_human_preview_anisotropy = (): void => {
  const texture = new THREE.DataTexture(new Uint8Array(4 * 8 * 4), 4, 8);
  const image = texture.image;
  const normal = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    normalMap: normal,
    alphaTest: 0.45,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const group = new THREE.Group();
  group.add(
    mesh,
    new THREE.Mesh(mesh.geometry, [material]),
    new THREE.Object3D(),
  );
  const geometry = mesh.geometry;
  prepareHumanPreview(group, 32);
  TestValidator.equals("device limit capped", texture.anisotropy, 16);
  TestValidator.equals("normal sampling", normal.anisotropy, 16);
  TestValidator.equals("shared colour upload once", texture.version, 1);
  TestValidator.equals("normal upload once", normal.version, 1);
  prepareHumanPreview(group, 16);
  TestValidator.equals("same sampler needs no upload", texture.version, 1);
  TestValidator.predicate("same image", texture.image === image);
  TestValidator.predicate("same geometry", mesh.geometry === geometry);
  TestValidator.predicate("same map", material.map === texture);
  TestValidator.equals("same cutoff", material.alphaTest, 0.45);
  prepareHumanPreview(group, 4);
  TestValidator.equals("lower device limit", texture.anisotropy, 4);
  prepareHumanPreview(group, 0);
  TestValidator.equals("unsupported device", texture.anisotropy, 1);
  TestValidator.equals("three sampler changes", texture.version, 3);
  prepareHumanPreview(group);
  TestValidator.equals("default remains isotropic", texture.version, 3);
  for (const invalid of [-1, -Number.MIN_VALUE, NaN, Infinity, -Infinity]) {
    mesh.castShadow = false;
    TestValidator.predicate(
      "invalid device limit",
      throwsError(() => prepareHumanPreview(group, invalid)),
    );
    TestValidator.equals("refusal preserves sampler", texture.version, 3);
    TestValidator.equals("refusal precedes traversal", mesh.castShadow, false);
  }
};
