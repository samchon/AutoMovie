import { buildModel, flattenInstancedObject } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { throwsError } from "../internal/predicates";
import {
  vertexColourMesh,
  vertexColourModel,
} from "../internal/vertexColourFixture";

/**
 * Imported colour alignment is refused before instancing reads missing values.
 *
 * Scenarios:
 * 1. Two-channel colour and incomplete RGB/RGBA arrays refuse explicitly.
 * 2. Replacing only that attribute with aligned RGB admits the same geometry.
 */
export const test_viewer_vertex_colour_instancing_refusals = (): void => {
  const built = buildModel(vertexColourModel([vertexColourMesh()]));
  const part = [...built.parts.values()][0] as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >;
  for (const [size, count] of [
    [2, 3],
    [3, 2],
    [4, 2],
  ]) {
    part.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        new Array(size! * count!).fill(1),
        size!,
      ),
    );
    TestValidator.predicate(
      "malformed colour refused",
      throwsError(
        () => flattenInstancedObject(built),
        "one RGB or RGBA colour per vertex",
      ),
    );
    part.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(new Array(9).fill(1), 3),
    );
    const valid = flattenInstancedObject(built);
    TestValidator.equals(
      "adjacent aligned input",
      valid.geometry.getAttribute("color").count,
      3,
    );
    valid.geometry.dispose();
  }
  part.geometry.dispose();
  part.material.dispose();
};
