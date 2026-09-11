import { TestValidator } from "@nestia/e2e";

import { subdividePortraitQuads } from "../../subjects/subdividePortraitQuads";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Quad refinement preserves a shared surface and its material ownership.
 * Scenarios:
 * 1. A unit square's boundary corner becomes (1/8,1/8), its face point is
 *    (1/2,1/2), and every child retains its material label. Inputs stay intact.
 * 2. A closed cube's corners become 5/9 of their original coordinates. An unused
 *    vertex, empty mesh, zero rounds and repeated refinement remain defined.
 * 3. Invalid dimensions, faces, sampling and nonmanifold/inverted joins refuse;
 *    large finite coordinates do not overflow an otherwise valid refinement.
 */
export const test_subject_quad_subdivision = (): void => {
  const square = {
    positions: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
    faces: [[0, 1, 2, 3]],
    groups: [7],
  };
  const before = structuredClone(square),
    refined = subdividePortraitQuads(square, 1);
  TestValidator.predicate(
    "boundary curve oracle",
    refined.positions[0].every((v, i) => nclose(v, [0.125, 0.125, 0][i])),
  );
  TestValidator.predicate(
    "face centre oracle",
    refined.positions.at(-1)!.every((v, i) => nclose(v, [0.5, 0.5, 0][i])),
  );
  TestValidator.equals("labels inherit", refined.groups, [7, 7, 7, 7]);
  TestValidator.equals("input retained", square, before);
  TestValidator.equals(
    "zero rounds",
    subdividePortraitQuads(square, 0),
    square,
  );
  TestValidator.equals(
    "empty surface",
    subdividePortraitQuads({ positions: [], faces: [], groups: [] }, 1),
    { positions: [], faces: [], groups: [] },
  );
  const cube = {
    positions: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
      [9, 9, 9],
    ],
    faces: [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 7, 6, 2],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
    ],
    groups: [0, 0, 0, 0, 0, 0],
  };
  const smooth = subdividePortraitQuads(cube, 1);
  TestValidator.predicate(
    "closed cube corner rule",
    smooth.positions
      .slice(0, 8)
      .every((p, i) =>
        p.every((v, a) => nclose(v, (cube.positions[i][a] * 5) / 9)),
      ),
  );
  TestValidator.equals("unused point retained", smooth.positions[8], [9, 9, 9]);
  TestValidator.predicate(
    "repeated refinement finite",
    subdividePortraitQuads(square, 3).positions.flat().every(Number.isFinite),
  );
  const huge = {
    ...square,
    positions: square.positions.map((p) => [Number.MAX_VALUE, p[1], p[0]]),
  };
  TestValidator.predicate(
    "large finite coordinates retained",
    subdividePortraitQuads(huge, 1).positions.every(
      (p) => p[0] === Number.MAX_VALUE && p.every(Number.isFinite),
    ),
  );
  for (const rounds of [-1, 0.5, 4])
    TestValidator.predicate(
      "invalid rounds refuse",
      throwsError(
        () => subdividePortraitQuads(square, rounds),
        "Quad refinement",
      ),
    );
  for (const mesh of [
    { ...square, groups: [] },
    { ...square, positions: [[0, 0]] },
    { ...square, faces: [[0, 1, 2]] },
    { ...square, faces: [[0, 1, 2, 2]] },
    { ...square, faces: [[0, 1, 2, 99]] },
  ])
    TestValidator.predicate(
      "invalid cage refuses",
      throwsError(() => subdividePortraitQuads(mesh, 1), "Quad refinement"),
    );
  TestValidator.predicate(
    "same winding refuses",
    throwsError(
      () =>
        subdividePortraitQuads(
          {
            ...square,
            faces: [square.faces[0], square.faces[0]],
            groups: [0, 0],
          },
          1,
        ),
      "adjacency",
    ),
  );
  TestValidator.predicate(
    "overfull edge refuses",
    throwsError(
      () =>
        subdividePortraitQuads(
          {
            ...square,
            faces: [square.faces[0], [3, 2, 1, 0], square.faces[0]],
            groups: [0, 0, 0],
          },
          1,
        ),
      "adjacency",
    ),
  );
  const bowtie = {
    positions: [...square.positions, [2, 0, 0], [2, -1, 0], [1, -1, 0]],
    faces: [
      [0, 1, 2, 3],
      [1, 4, 5, 6],
    ],
    groups: [0, 0],
  };
  TestValidator.predicate(
    "split boundary fan refuses",
    throwsError(() => subdividePortraitQuads(bowtie, 1), "boundary neighbours"),
  );
};
