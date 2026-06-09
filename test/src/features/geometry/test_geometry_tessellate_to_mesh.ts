import { tessellateToMesh } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * `tessellateToMesh` adapts a raw tessellation into a full `IAutoFilmMesh`, so
 * a generated primitive can flow through the same code paths as imported mesh
 * geometry. It carries positions and indices through and leaves skinning null,
 * since generated primitives are not skinned.
 *
 * Scenario: a unit box yields 72 position floats (24 vertices × 3), 36 indices,
 * and a null `skin`.
 */
export const test_geometry_tessellate_to_mesh = (): void => {
  const mesh = tessellateToMesh({ type: "box", width: 1, height: 1, depth: 1 });
  TestValidator.equals("72 position floats", mesh.positions.length, 72);
  TestValidator.predicate(
    "has indices",
    mesh.indices !== null && mesh.indices.length === 36,
  );
  TestValidator.equals("no skin", mesh.skin, null);
};
