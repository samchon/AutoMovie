import { TestValidator } from "@nestia/e2e";

import { subdivideControlMesh } from "../../subjects/subdivideControlMesh";
import { throwsError } from "../internal/predicates";

/**
 * A shared anatomical curve retains its one-dimensional subdivision rule even
 * when the triangles on either side have asymmetric opposite vertices.
 *
 * Scenarios:
 * 1. An octahedral equator remains in Z=0, with X=3/4 after one round and
 *    X=11/16 after two. General surface weights instead pull it toward Z=3.
 * 2. Face labels, off-curve poles and caller-owned arrays retain their meaning;
 *    omitted/empty curves are identical, as are reversed curve orientations.
 * 3. Short, repeated, overlapping, nonresident and disconnected loops refuse,
 *    including zero-round requests. A real open boundary remains supported.
 */
export const test_subject_subdivision_curves = (): void => {
  const mesh = {
    positions: [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 3],
      [0, 0, -1],
    ],
    indices: [
      4, 0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 5, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3,
    ],
    groups: [0, 0, 0, 0, 1, 1, 1, 1],
  };
  const loop = [0, 2, 1, 3];
  const before = structuredClone({ mesh, loop });
  const basic = subdivideControlMesh(mesh, 1);
  const once = subdivideControlMesh(mesh, 1, [loop]);
  const twice = subdivideControlMesh(mesh, 2, [loop]);
  TestValidator.equals("curve corner", once.positions[0], [0.75, 0, 0]);
  TestValidator.equals(
    "surface corner differs",
    basic.positions[0],
    [0.625, 0, 0.1875],
  );
  TestValidator.equals(
    "second curve corner",
    twice.positions[0],
    [0.6875, 0, 0],
  );
  TestValidator.predicate(
    "midpoint stays in equator",
    once.positions.some((p) => p[0] === 0.5 && p[1] === 0.5 && p[2] === 0),
  );
  TestValidator.equals(
    "pole retains surface rule",
    once.positions[4],
    basic.positions[4],
  );
  TestValidator.equals(
    "labels retain shared surface",
    once.groups,
    basic.groups,
  );
  TestValidator.equals("input ownership", { mesh, loop }, before);
  TestValidator.equals(
    "empty identity",
    subdivideControlMesh(mesh, 1, []),
    basic,
  );
  TestValidator.equals(
    "orientation independent",
    subdivideControlMesh(mesh, 2, [[...loop].reverse()]),
    twice,
  );
  TestValidator.equals(
    "zero round",
    subdivideControlMesh(mesh, 0, [loop]),
    mesh,
  );
  for (const curves of [
    [[]],
    [[0, 2]],
    [[0, 2, 0]],
    [loop, loop],
    [[0, 1, 2]],
    [[-1, 0, 2]],
    [[6, 0, 2]],
    [[0.5, 0, 2]],
    [[NaN, 0, 2]],
  ])
    TestValidator.predicate(
      "invalid curve refuses",
      throwsError(() => subdivideControlMesh(mesh, 0, curves)),
    );
  const triangle = {
    positions: [
      [0, 0, 0],
      [2, 0, 0],
      [0, 2, 0],
    ],
    indices: [0, 1, 2],
    groups: [3],
  };
  TestValidator.equals(
    "open boundary same rule",
    subdivideControlMesh(triangle, 2, [[0, 1, 2]]),
    subdivideControlMesh(triangle, 2),
  );
};
