import { TestValidator } from "@nestia/e2e";

import { fitPortraitJoinBoundary } from "../../subjects/portraitJoinTangency";
import { refinePortraitJoin } from "../../subjects/refinePortraitJoin";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Boundary jets match neighbouring planes while retaining each sample's edge frame.
 *
 * Scenarios:
 * 1. A refined triangular region rises 0.4mm over flat neighbours. Its first
 *    row returns to z=0; the AB witness keeps x=4/3 and obtains y=sqrt(61)/15
 *    from its original transverse distance. Boundaries and input remain owned.
 * 2. A flat coarse first row merges compatible targets; a raised shared sample
 *    refuses incompatible ones. Missing/duplicate neighbours, immovable samples,
 *    invalid input and degenerate frames refuse. An absent group is neutral.
 */
export const test_subject_join_tangency = (): void => {
  const make = (rounds: number, height: number) => {
    const cage = {
      positions: [
        [0, 0, 0],
        [3, 0, 0],
        [0, 3, 0],
        [1, -2, 0],
        [4, 4, 0],
        [-2, 1, 0],
      ],
      indices: [1, 0, 3, 2, 1, 4, 0, 2, 5],
      groups: [0, 0, 0],
    };
    const join = refinePortraitJoin(cage, [[0, 1, 2]], rounds);
    for (let id = 6; id < cage.positions.length; id++)
      cage.positions[id][2] = height;
    for (const tri of join) {
      cage.indices.push(...tri);
      cage.groups.push(1);
    }
    return { ...cage, normals: [], join };
  };
  const host = make(2, 0.4),
    before = structuredClone(host),
    targets = fitPortraitJoinBoundary(host, 1);
  TestValidator.equals(
    "three independent first-row targets",
    targets.length,
    3,
  );
  TestValidator.predicate(
    "boundary and outside vertices untouched",
    targets.every((t) => t.vertex >= 6),
  );
  TestValidator.predicate(
    "neighbouring plane matched",
    targets.every((t) => nclose(t.target[2], 0)),
  );
  const witness = host.join.find((tri) => tri[0] === 0 && tri[1] === 1)![2];
  const point = targets.find((t) => t.vertex === witness)!.target;
  TestValidator.predicate(
    "hand tangent-row coordinate",
    nclose(point[0], 4 / 3) && nclose(point[1], Math.sqrt(61) / 15),
  );
  TestValidator.equals("input owned", host, before);
  TestValidator.equals("absent region", fitPortraitJoinBoundary(host, 99), []);
  const compatible = fitPortraitJoinBoundary(make(1, 0), 1);
  TestValidator.equals("compatible shared sample", compatible.length, 1);
  TestValidator.predicate(
    "shared planar target",
    compatible[0].target.every((v, k) => nclose(v, [1, 1, 0][k])),
  );
  TestValidator.predicate(
    "conflicting shared sample",
    throwsError(() => fitPortraitJoinBoundary(make(1, 0.4), 1)),
  );
  TestValidator.predicate(
    "boundary-only samples refuse",
    throwsError(() => fitPortraitJoinBoundary(make(0, 0), 1)),
  );
  for (const group of [-1, 0.5])
    TestValidator.predicate(
      "invalid group",
      throwsError(() => fitPortraitJoinBoundary(host, group)),
    );
  for (const bad of [
    { ...host, groups: [] },
    { ...host, indices: [-1, ...host.indices.slice(1)] },
    { ...host, indices: [0.5, ...host.indices.slice(1)] },
    { ...host, indices: [host.positions.length, ...host.indices.slice(1)] },
    {
      ...host,
      positions: host.positions.map((p, i) => (i === 0 ? [0, 0] : p)),
    },
    {
      ...host,
      positions: host.positions.map((p, i) => (i === 0 ? [NaN, 0, 0] : p)),
    },
    { ...host, indices: host.indices.slice(3), groups: host.groups.slice(1) },
    {
      ...host,
      indices: [...host.indices, 1, 0, 3],
      groups: [...host.groups, 0],
    },
    {
      ...host,
      indices: [...host.indices, ...host.join[0], ...host.join[0]],
      groups: [...host.groups, 1, 1],
    },
    {
      ...host,
      positions: host.positions.map((p, i) => (i === 3 ? [1, 0, 0] : p)),
    },
    {
      ...host,
      positions: host.positions.map((p, i) =>
        i === witness ? [1.5, 0, 0] : p,
      ),
    },
    {
      ...host,
      positions: host.positions.map((p, i) =>
        i === witness
          ? [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE]
          : p,
      ),
    },
  ])
    TestValidator.predicate(
      "invalid tangent basis",
      throwsError(() => fitPortraitJoinBoundary(bad, 1)),
    );
};
