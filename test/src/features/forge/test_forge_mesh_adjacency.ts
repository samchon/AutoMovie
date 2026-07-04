import { meshAdjacency } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * Adjacency and boundary classification on a hexagon fan: ring edges belong to
 * one triangle each (boundary), spokes to two (interior), so the six ring
 * vertices are boundary while the center is interior ??and the center's
 * neighbors are exactly the ring.
 *
 * Scenario: vertex 0 fanned to ring 1..6; center interior with 6 neighbors,
 * every ring vertex boundary with neighbors {center, prev, next}.
 */
export const test_forge_mesh_adjacency = (): void => {
  const indices: number[] = [];
  for (let i = 0; i < 6; i++) indices.push(0, 1 + i, 1 + ((i + 1) % 6));
  const mesh = meshAdjacency(indices, 7);

  TestValidator.equals("center is interior", mesh.boundary[0], false);
  TestValidator.predicate(
    "ring is boundary",
    mesh.boundary.slice(1).every((b) => b === true),
  );
  TestValidator.equals(
    "center neighbors are the ring",
    [...mesh.adjacency[0]!].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6],
  );
  TestValidator.equals(
    "ring vertex 2 neighbors center + prev + next",
    [...mesh.adjacency[2]!].sort((a, b) => a - b),
    [0, 1, 3],
  );
};
