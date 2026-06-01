import { tessellate } from "@motica/engine";
import { MoticaPrimitiveShape } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

const SHAPES: MoticaPrimitiveShape[] = [
  { type: "box", width: 0.4, height: 0.6, depth: 0.2 },
  { type: "sphere", radius: 0.5 },
  { type: "cylinder", radius: 0.3, height: 1 },
  { type: "cone", radius: 0.3, height: 1 },
  { type: "plane", width: 2, depth: 3 },
  { type: "capsule", radius: 0.2, height: 1 },
];

/**
 * Every primitive tessellation must be well-formed mesh data: positions in xyz
 * triples, one normal per position, triangle index list, all positions finite,
 * and every index within the vertex range. These are the invariants a renderer
 * relies on to upload geometry safely.
 */
export const test_geometry_tessellate_invariants = (): void => {
  for (const shape of SHAPES) {
    const t = tessellate(shape);
    const vertexCount = t.positions.length / 3;
    TestValidator.predicate(
      `${shape.type}: positions are triples`,
      t.positions.length % 3 === 0,
    );
    TestValidator.equals(
      `${shape.type}: a normal per position`,
      t.normals.length,
      t.positions.length,
    );
    TestValidator.predicate(
      `${shape.type}: indices are triangles`,
      t.indices.length % 3 === 0,
    );
    TestValidator.predicate(
      `${shape.type}: non-empty`,
      vertexCount > 0 && t.indices.length > 0,
    );
    TestValidator.predicate(
      `${shape.type}: positions finite`,
      t.positions.every((n) => Number.isFinite(n)),
    );
    TestValidator.predicate(
      `${shape.type}: indices in range`,
      t.indices.every((i) => Number.isInteger(i) && i >= 0 && i < vertexCount),
    );
  }
};
