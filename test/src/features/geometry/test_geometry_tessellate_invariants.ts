import { tessellate } from "@automovie/engine";
import { automoviePrimitiveShape } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const SHAPES: automoviePrimitiveShape[] = [
  { type: "box", width: 0.4, height: 0.6, depth: 0.2 },
  { type: "sphere", radius: 0.5 },
  { type: "cylinder", radius: 0.3, height: 1 },
  { type: "cone", radius: 0.3, height: 1 },
  { type: "plane", width: 2, depth: 3 },
  { type: "capsule", radius: 0.2, height: 1 },
];

/**
 * Whatever primitive it tessellates, the engine must emit well-formed mesh data
 * ??the structural invariants a renderer relies on to upload geometry to the
 * GPU without crashing or drawing garbage. This sweeps all six primitive types
 * through the same battery of checks.
 *
 * Scenarios (asserted for box, sphere, cylinder, cone, plane, and capsule):
 *
 * 1. Positions come in xyz triples (length divisible by 3).
 * 2. There is exactly one normal per position.
 * 3. Indices come in triangles (length divisible by 3).
 * 4. The mesh is non-empty (it has both vertices and triangles).
 * 5. Every position is finite (no NaN / Infinity).
 * 6. Every index is an integer inside the vertex range ??no out-of-bounds
 *    reference that would read past the vertex buffer.
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
