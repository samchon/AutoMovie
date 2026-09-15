import { exportModelToGLB } from "@automovie/render/node";
import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import {
  vertexColourMesh,
  vertexColourModel,
} from "../internal/vertexColourFixture";

/**
 * The generic static serializer must not discard resident RGB either.
 *
 * Scenarios:
 * 1. Binary round-trip carries VEC3 linear colour for the coloured part.
 * 2. The bare neighbour emits no colour attribute and remains a separate node.
 */
export const test_render_vertex_colour_export = async (): Promise<void> => {
  const colored = vertexColourMesh();
  const { colors: _colors, ...bare } = colored;
  const doc = await new NodeIO().readBinary(
    await exportModelToGLB(vertexColourModel([colored, bare])),
  );
  const primitives = doc
    .getRoot()
    .listMeshes()
    .map((m) => m.listPrimitives()[0]!);
  const colors = primitives[0]!.getAttribute("COLOR_0")!;
  TestValidator.equals("RGB type", colors.getType(), "VEC3");
  TestValidator.equals(
    "binary RGB values",
    Array.from(colors.getArray()!),
    colored.colors,
  );
  TestValidator.equals(
    "bare attribute omitted",
    primitives[1]!.getAttribute("COLOR_0"),
    null,
  );
};
