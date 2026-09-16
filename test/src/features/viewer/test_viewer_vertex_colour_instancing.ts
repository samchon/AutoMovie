import { flattenInstancedModel } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import {
  vertexColourMesh,
  vertexColourModel,
} from "../internal/vertexColourFixture";

/**
 * Instanced lowering preserves RGB and material groups across bare neighbours.
 *
 * Scenarios:
 * 1. Mixed RGB/bare parts flatten with white identity values in the bare part.
 * 2. All-coloured parts retain their ordered triples; all-bare parts stay bare.
 * 3. Flattening never adds an attribute to the caller's mesh document.
 */
export const test_viewer_vertex_colour_instancing = (): void => {
  const colored = vertexColourMesh();
  const { colors: _colors, ...bare } = colored;
  const model = vertexColourModel([colored, bare]);
  const before = structuredClone(model);
  const mixed = flattenInstancedModel(model);
  TestValidator.equals(
    "mixed identity RGB",
    Array.from(mixed.geometry.getAttribute("color").array),
    [...colored.colors!, ...new Array(9).fill(1)],
  );
  TestValidator.equals("material spans", mixed.geometry.groups, [
    { start: 0, count: 3, materialIndex: 0 },
    { start: 3, count: 3, materialIndex: 1 },
  ]);
  TestValidator.equals(
    "only coloured material reads RGB",
    (mixed.materials as THREE.MeshStandardMaterial[]).map(
      (m) => m.vertexColors,
    ),
    [true, false],
  );
  TestValidator.equals("caller unchanged", model, before);
  const all = flattenInstancedModel(vertexColourModel([colored, colored]));
  TestValidator.equals(
    "all RGB preserved",
    Array.from(all.geometry.getAttribute("color").array),
    [...colored.colors!, ...colored.colors!],
  );
  const empty = flattenInstancedModel(vertexColourModel([bare, bare]));
  TestValidator.equals(
    "bare has no colour",
    empty.geometry.hasAttribute("color"),
    false,
  );
  for (const result of [mixed, all, empty]) {
    result.geometry.dispose();
    for (const material of new Set(result.materials)) material.dispose();
  }
};
