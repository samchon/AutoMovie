import { selectAutoMovieTriangleRegion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * An oriented anatomical boundary selects source triangles by connectivity.
 * Projection and coordinate changes cannot change the selected population.
 *
 * Scenarios:
 * 1. A square inside a triangulated annulus selects exactly its two triangles;
 *    the outer boundary selects all ten and a reversed inner loop refuses
 *    to consume unrelated exterior free edges.
 * 2. Either oriented side of a triangular loop on a closed tetrahedron is a
 *    valid patch. A nonseparating cycle around a periodic torus is refused.
 * 3. Invalid boundaries, incomplete/degenerate triangles, inconsistent winding
 *    and nonmanifold edges are refused before a partial cut can be returned.
 */
export const test_geometry_triangle_region = (): void => {
  const indices = [
    0, 1, 2, 0, 2, 3, 4, 5, 1, 4, 1, 0, 5, 6, 2, 5, 2, 1, 6, 7, 3, 6, 3, 2, 7,
    4, 0, 7, 0, 3,
  ];
  TestValidator.equals(
    "inner square population",
    selectAutoMovieTriangleRegion({ indices, boundary: [0, 1, 2, 3] }),
    [0, 1],
  );
  TestValidator.equals(
    "complete outer population",
    selectAutoMovieTriangleRegion({ indices, boundary: [4, 5, 6, 7] }),
    Array.from({ length: 10 }, (_v, i) => i),
  );
  TestValidator.predicate(
    "exterior is not silently cut",
    throwsError(() =>
      selectAutoMovieTriangleRegion({ indices, boundary: [3, 2, 1, 0] }),
    ),
  );
  TestValidator.predicate(
    "open boundary must follow its face winding",
    throwsError(() =>
      selectAutoMovieTriangleRegion({
        indices: [0, 1, 2],
        boundary: [2, 1, 0],
      }),
    ),
  );
  const tetra = [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3];
  TestValidator.equals(
    "closed inward face",
    selectAutoMovieTriangleRegion({ indices: tetra, boundary: [0, 2, 1] }),
    [0],
  );
  TestValidator.equals(
    "closed opposite patch",
    selectAutoMovieTriangleRegion({ indices: tetra, boundary: [1, 2, 0] }),
    [1, 2, 3],
  );
  const torus: number[] = [];
  const vertex = (x: number, y: number): number => (y % 3) * 3 + (x % 3);
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 3; x++) {
      const a = vertex(x, y),
        b = vertex(x + 1, y),
        c = vertex(x + 1, y + 1),
        d = vertex(x, y + 1);
      torus.push(a, b, c, a, c, d);
    }
  TestValidator.predicate(
    "nonseparating boundary is refused",
    throwsError(() =>
      selectAutoMovieTriangleRegion({ indices: torus, boundary: [0, 1, 2] }),
    ),
  );
  for (const boundary of [
    [],
    [0, 1],
    [0, 1, 2, 0],
    [0, 2, 4],
    [0, 1, NaN],
    [0, 1, -1],
  ])
    TestValidator.predicate(
      "invalid boundary",
      throwsError(() => selectAutoMovieTriangleRegion({ indices, boundary })),
    );
  for (const broken of [
    [0, 1],
    [0, 0, 1],
    [-1, 1, 2],
    [0, 1, 2, 0, 1, 3],
    [0, 1, 2, 1, 0, 3, 0, 1, 4],
  ])
    TestValidator.predicate(
      "invalid triangle source",
      throwsError(() =>
        selectAutoMovieTriangleRegion({ indices: broken, boundary: [0, 1, 2] }),
      ),
    );
};
