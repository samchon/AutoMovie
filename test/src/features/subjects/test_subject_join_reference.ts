import { TestValidator } from "@nestia/e2e";

import { fitPortraitJoinReference } from "../../subjects/portraitJoinReference";
import { refinePortraitJoin } from "../../subjects/refinePortraitJoin";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Joining shape follows a source surface with bounded attachment displacement.
 *
 * Scenarios:
 * 1. A planar join with one spurious 99mm interior peak recovers z=2+x/2-y/4.
 *    Source planes offset by -2, zero and +2 require constant signed corrections.
 *    Shared boundaries remain absent from proposals and input remains owned.
 * 2. A missing group queries no source. Missing/nonfinite heights, overflowing
 *    source distances and nonfinite relaxed output refuse instead of publishing.
 */
export const test_subject_join_reference = (): void => {
  const cage = {
    positions: [
      [0, 0],
      [3, 0],
      [0, 3],
      [1, -2],
      [4, 4],
      [-2, 1],
    ].map(([x, y]) => [x, y, 2 + x / 2 - y / 4]),
    indices: [1, 0, 3, 2, 1, 4, 0, 2, 5],
    groups: [0, 0, 0],
    normals: [],
  };
  for (const tri of refinePortraitJoin(cage, [[0, 1, 2]], 2)) {
    cage.indices.push(...tri);
    cage.groups.push(1);
  }
  // This old face centre is inside the joining region, not its first tangent row.
  cage.positions[6][2] = 99;
  const before = structuredClone(cage);
  for (const base of [0, 2, 4]) {
    const result = fitPortraitJoinReference(
      cage,
      1,
      (x, y) => base + x / 2 - y / 4,
    );
    TestValidator.predicate(
      "actual interior proposals",
      result.length > 3 && result.every((t) => t.vertex >= 6),
    );
    TestValidator.predicate(
      "independent plane recovered",
      result.every(({ target: [x, y, z] }) => nclose(z, 2 + x / 2 - y / 4)),
    );
    TestValidator.predicate(
      "fixed XY chart",
      result.every(
        ({ vertex, target }) =>
          target[0] === cage.positions[vertex][0] &&
          target[1] === cage.positions[vertex][1],
      ),
    );
    TestValidator.predicate(
      "bounded signed source adjustment",
      result.every(({ target: [x, y, z] }) => {
        const delta = z - (base + x / 2 - y / 4);
        return (
          delta >= Math.min(0, 2 - base) - 1e-8 &&
          delta <= Math.max(0, 2 - base) + 1e-8
        );
      }),
    );
  }
  TestValidator.equals("input ownership", cage, before);
  let calls = 0;
  TestValidator.equals(
    "absent group",
    fitPortraitJoinReference(cage, 9, () => {
      calls++;
      return 0;
    }),
    [],
  );
  TestValidator.equals("no unused source queries", calls, 0);
  for (const height of [null, NaN, Infinity])
    TestValidator.predicate(
      "invalid source height",
      throwsError(() => fitPortraitJoinReference(cage, 1, () => height)),
    );
  TestValidator.predicate(
    "source-distance overflow",
    throwsError(() =>
      fitPortraitJoinReference(cage, 1, (x) =>
        x > 1 ? Number.MAX_VALUE : -Number.MAX_VALUE,
      ),
    ),
  );
  TestValidator.predicate(
    "relaxation overflow",
    throwsError(() =>
      fitPortraitJoinReference(cage, 1, () => Number.MAX_VALUE),
    ),
  );
};
