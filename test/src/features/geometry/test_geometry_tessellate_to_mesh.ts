import { tessellateToMesh } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * `tessellateToMesh` wraps a tessellation into a full `IMoticaMesh` — positions
 * and indices populated, no skinning (generated primitives are not skinned).
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
