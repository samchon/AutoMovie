import { TestValidator } from "@nestia/e2e";

import { assertPortraitSkinTopology } from "../../subjects/portraitSkinTopology";
import { throwsError } from "../internal/predicates";

/**
 * The host accepts intended openings and refuses accidental component seams.
 * A planar quad and a closed tetrahedron give independent topology witnesses.
 *
 * Scenarios:
 * 1. A quad has exactly its declared outer loop; a tetrahedron has none.
 * 2. Removing or reversing a triangle, or adding a third incident face, fails.
 * 3. Missing, repeated, short or nonexistent declared rims fail; invalid vertex
 *    identities fail before refinement. An empty cage has no seam obligation.
 */
export const test_subject_skin_topology = (): void => {
  const positions = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const quad = { positions, indices: [0, 1, 2, 0, 2, 3], groups: [0, 0] };
  assertPortraitSkinTopology(quad, [[0, 1, 2, 3]]);
  assertPortraitSkinTopology(
    {
      positions,
      indices: [0, 2, 1, 0, 1, 4, 1, 2, 4, 2, 0, 4],
      groups: [0, 0, 0, 0],
    },
    [],
  );
  assertPortraitSkinTopology({ positions: [], indices: [], groups: [] }, []);
  for (const indices of [
    [0, 1, 2],
    [0, 1, 2, 0, 3, 2],
    [0, 1, 2, 0, 1, 2, 0, 1, 2],
    [-1, 1, 2],
    [0.5, 1, 2],
    [5, 1, 2],
    [0, 0, 1],
    [0, 1],
  ])
    TestValidator.predicate(
      "invalid attachment topology refused",
      throwsError(() =>
        assertPortraitSkinTopology({ ...quad, indices }, [[0, 1, 2, 3]]),
      ),
    );
  for (const loops of [
    [],
    [[0, 1]],
    [[0, 1, 1]],
    [
      [0, 1, 2, 3],
      [0, 1, 2, 3],
    ],
    [
      [0, 1, 2, 3],
      [0, 2, 4],
    ],
  ])
    TestValidator.predicate(
      "invalid declared openings refused",
      throwsError(() => assertPortraitSkinTopology(quad, loops)),
    );
};
