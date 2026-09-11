import { TestValidator } from "@nestia/e2e";

import { subdivideControlMesh } from "../../subjects/subdivideControlMesh";
import { nclose } from "../internal/predicates";

/**
 * Subdivision refines topology without losing face labels or boundary meaning.
 * The positions below follow the boundary and interior Loop weights by hand.
 *
 * Scenarios:
 * 1. An open right triangle produces four labelled faces and boundary vertices
 *    at (1/4,1/4), (3/2,1/4), and (1/4,3/2); an isolated point stays fixed.
 * 2. A second round preserves labels and puts the original corner at (5/16,5/16).
 * 3. A tetrahedron exercises valence three; an octahedron exercises valence four
 *    and the two-opposite-vertex interior edge rule.
 * 4. Zero rounds and an empty cage preserve their respective empty/identity cases.
 */
export const test_subject_subdivision = (): void => {
  const triangle = {
    positions: [
      [0, 0, 0],
      [2, 0, 0],
      [0, 2, 0],
      [8, 8, 8],
    ],
    indices: [0, 1, 2],
    groups: [7],
  };
  const once = subdivideControlMesh(triangle, 1);
  TestValidator.equals("boundary corner", once.positions[0], [0.25, 0.25, 0]);
  TestValidator.equals("isolated control point", once.positions[3], [8, 8, 8]);
  TestValidator.equals("four inherited labels", once.groups, [7, 7, 7, 7]);
  TestValidator.equals("source is unchanged", triangle.positions[0], [0, 0, 0]);
  TestValidator.equals(
    "second boundary corner",
    subdivideControlMesh(triangle, 2).positions[0],
    [0.3125, 0.3125, 0],
  );
  TestValidator.equals(
    "zero-round identity",
    subdivideControlMesh(triangle, 0),
    triangle,
  );
  TestValidator.equals(
    "empty cage",
    subdivideControlMesh({ positions: [], indices: [], groups: [] }, 1),
    { positions: [], indices: [], groups: [] },
  );

  const tetra = subdivideControlMesh(
    {
      positions: [
        [1, 1, 1],
        [-1, -1, 1],
        [-1, 1, -1],
        [1, -1, -1],
      ],
      indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
      groups: [0, 0, 0, 0],
    },
    1,
  );
  TestValidator.equals(
    "valence-three corner",
    tetra.positions[0],
    [0.25, 0.25, 0.25],
  );
  const octa = subdivideControlMesh(
    {
      positions: [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ],
      indices: [
        4, 0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 5, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3,
      ],
      groups: new Array<number>(8).fill(2),
    },
    1,
  );
  TestValidator.equals("valence-four corner", octa.positions[0], [0.625, 0, 0]);
  TestValidator.predicate(
    "interior edge uses both opposite vertices",
    octa.positions.some(
      (p) => nclose(p[0], 0.375) && nclose(p[1], 0) && nclose(p[2], 0.375),
    ),
  );
};
