import { buildModel, flattenInstancedObject } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { nclose } from "../internal/predicates";
import {
  vertexColourMesh,
  vertexColourModel,
} from "../internal/vertexColourFixture";

/**
 * Imported normalized and interleaved colours share a lossless shader meaning.
 *
 * Scenarios:
 * 1. Normalized Uint8 RGBA, interleaved RGB and bare parts merge as Float32 RGBA.
 * 2. Integer channels decode by /255; missing alpha and bare channels equal one.
 * 3. The imported attributes retain their original storage and item sizes.
 */
export const test_viewer_vertex_colour_imported_instancing = (): void => {
  const colored = vertexColourMesh();
  const { colors: _colors, ...bare } = colored;
  const built = buildModel(vertexColourModel([colored, colored, bare]));
  const parts = [...built.parts.values()] as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >[];
  const rgba = new THREE.Uint8BufferAttribute(
    [255, 0, 128, 64, 0, 255, 64, 128, 128, 64, 255, 255],
    4,
    true,
  );
  const rgb = new THREE.InterleavedBufferAttribute(
    new THREE.InterleavedBuffer(
      new Uint8Array([7, 255, 128, 0, 7, 0, 255, 64, 7, 64, 0, 255]),
      4,
    ),
    3,
    1,
    true,
  );
  parts[0]!.geometry.setAttribute("color", rgba);
  parts[1]!.geometry.setAttribute("color", rgb);
  const flattened = flattenInstancedObject(built);
  const result = flattened.geometry.getAttribute("color");
  const expected = [
    1,
    0,
    128 / 255,
    64 / 255,
    0,
    1,
    64 / 255,
    128 / 255,
    128 / 255,
    64 / 255,
    1,
    1,
    1,
    128 / 255,
    0,
    1,
    0,
    1,
    64 / 255,
    1,
    64 / 255,
    0,
    1,
    1,
    ...new Array(12).fill(1),
  ];
  TestValidator.equals("RGBA layout", result.itemSize, 4);
  TestValidator.equals("complete output", result.array.length, expected.length);
  TestValidator.predicate(
    "decoded RGBA",
    Array.from(result.array).every((value, i) => nclose(value, expected[i]!)),
  );
  TestValidator.predicate(
    "float storage",
    result.array instanceof Float32Array,
  );
  TestValidator.predicate(
    "source storage owned",
    parts[0]!.geometry.getAttribute("color") === rgba &&
      parts[1]!.geometry.getAttribute("color") === rgb,
  );
  TestValidator.equals("source RGB not promoted", rgb.itemSize, 3);
  TestValidator.equals("source byte not decoded in place", rgba.array[2], 128);
  TestValidator.equals(
    "source bare stays bare",
    parts[2]!.geometry.hasAttribute("color"),
    false,
  );
  flattened.geometry.dispose();
  for (const part of parts) part.geometry.dispose();
  for (const material of new Set(flattened.materials)) material.dispose();
};
