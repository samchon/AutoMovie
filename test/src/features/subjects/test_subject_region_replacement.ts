import { TestValidator } from "@nestia/e2e";

import { applyPortraitRegionReplacements } from "../../subjects/portraitRegionReplacement";
import { throwsError } from "../internal/predicates";

/**
 * Deferred regions read their boundaries before any replacement mutates topology.
 *
 * Scenarios:
 * 1. Two separate triangular regions are restored alongside untouched skin;
 *    callbacks receive the original ordered loops and the input remains owned.
 * 2. Empty work preserves identity. Missing, repeated, invalid and disconnected
 *    region labels refuse before either appender can run.
 */
export const test_subject_region_replacement = (): void => {
  const mesh = {
    positions: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [2, 0, 0],
      [3, 0, 0],
      [2, 1, 0],
      [4, 0, 0],
      [5, 0, 0],
      [4, 1, 0],
    ],
    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    groups: [1, 2, 3],
  };
  const before = structuredClone(mesh);
  let calls = 0;
  const replacement = (group: number) => ({
    group,
    append: (cage: typeof mesh, boundary: readonly number[]) => {
      calls++;
      TestValidator.equals(
        "original oriented boundary",
        boundary,
        group === 1 ? [0, 1, 2] : [3, 4, 5],
      );
      cage.indices.push(...boundary);
      cage.groups.push(group);
    },
  });
  const out = applyPortraitRegionReplacements(mesh, [
    replacement(1),
    replacement(2),
  ]);
  TestValidator.equals("two appenders", calls, 2);
  TestValidator.equals(
    "unrelated region retained",
    out.indices.slice(0, 3),
    [6, 7, 8],
  );
  TestValidator.equals("owned input", mesh, before);
  TestValidator.predicate(
    "empty identity",
    applyPortraitRegionReplacements(mesh, []) === mesh,
  );
  calls = 0;
  for (const work of [
    [replacement(1), replacement(1)],
    [replacement(1), replacement(9)],
    ...[-1, 0.5, Infinity].map((group) => [replacement(group)]),
  ])
    TestValidator.predicate(
      "invalid region set",
      throwsError(() => applyPortraitRegionReplacements(mesh, work)),
    );
  TestValidator.predicate(
    "disconnected selected region",
    throwsError(() =>
      applyPortraitRegionReplacements({ ...mesh, groups: [1, 1, 3] }, [
        replacement(1),
      ]),
    ),
  );
  TestValidator.equals("all boundaries admitted before callbacks", calls, 0);
};
