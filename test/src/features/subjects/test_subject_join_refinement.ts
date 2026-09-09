import { TestValidator } from "@nestia/e2e";

import { refinePortraitJoin } from "../../subjects/refinePortraitJoin";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Joining refinement gives internal chords movable samples without splitting seams.
 *
 * Scenarios:
 * 1. Two triangles cover a four-mm square. Their diagonal gets exactly one shared
 *    midpoint, each face gets a centre, all four boundary edges stay exact, and
 *    eight positive triangles retain the independently known area of sixteen.
 * 2. Zero and empty work stay neutral; four rounds retain the same boundary.
 *    Bad rounds, nonresident/incomplete/nonfinite points and triple edges refuse.
 */
export const test_subject_join_refinement = (): void => {
  const original = [
      [0, 0, 2],
      [4, 0, 2],
      [4, 4, 2],
      [0, 4, 2],
    ],
    triangles = [
      [0, 1, 2],
      [0, 2, 3],
    ];
  const make = () => ({
    positions: original.map((p) => [...p]),
    indices: [] as number[],
    groups: [] as number[],
  });
  const cage = make(),
    input = structuredClone(triangles),
    result = refinePortraitJoin(cage, triangles, 1);
  TestValidator.equals("input triangles owned", triangles, input);
  TestValidator.equals(
    "source positions retained",
    cage.positions.slice(0, 4),
    original,
  );
  TestValidator.equals(
    "one midpoint plus two centres",
    cage.positions.length,
    7,
  );
  TestValidator.equals(
    "shared diagonal midpoint",
    cage.positions[4],
    [2, 2, 2],
  );
  TestValidator.equals("eight positive triangles", result.length, 8);
  const edgeCounts = (faces: number[][]) => {
    const counts = new Map<string, number>();
    for (const tri of faces)
      for (let i = 0; i < 3; i++) {
        const a = tri[i],
          b = tri[(i + 1) % 3],
          key = a < b ? `${a}/${b}` : `${b}/${a}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    return counts;
  };
  const edges = edgeCounts(result);
  TestValidator.predicate("old fixed chord removed", !edges.has("0/2"));
  TestValidator.equals(
    "unsplit boundary",
    [...edges]
      .filter(([, n]) => n === 1)
      .map(([e]) => e)
      .sort(),
    ["0/1", "0/3", "1/2", "2/3"],
  );
  let area = 0;
  for (const tri of result) {
    const [a, b, c] = tri.map((v) => cage.positions[v]);
    const signed =
      ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    TestValidator.predicate("positive face", signed > 0);
    area += signed;
  }
  TestValidator.predicate("area sixteen", nclose(area, 16));
  TestValidator.equals(
    "zero rounds",
    refinePortraitJoin(make(), triangles, 0),
    triangles,
  );
  TestValidator.equals(
    "empty population",
    refinePortraitJoin(make(), [], 2),
    [],
  );
  const maximum = refinePortraitJoin(make(), triangles, 4);
  TestValidator.equals(
    "maximum rounds retain boundary",
    [...edgeCounts(maximum)]
      .filter(([, n]) => n === 1)
      .map(([e]) => e)
      .sort(),
    ["0/1", "0/3", "1/2", "2/3"],
  );
  for (const rounds of [-1, 0.5, 5, NaN])
    TestValidator.predicate(
      "invalid rounds",
      throwsError(() => refinePortraitJoin(make(), triangles, rounds)),
    );
  for (const faces of [
    [[0, 1]],
    [[0, 1, 99]],
    [[-1, 1, 2]],
    [[0, 0.5, 2]],
    [
      [0, 1, 2],
      [1, 0, 3],
      [0, 1, 3],
    ],
  ])
    TestValidator.predicate(
      "invalid triangle incidence",
      throwsError(() => refinePortraitJoin(make(), faces, 1)),
    );
  for (const point of [
    [0, 0],
    [0, NaN, 2],
  ])
    TestValidator.predicate(
      "invalid point",
      throwsError(() =>
        refinePortraitJoin(
          { ...make(), positions: [point, ...original.slice(1)] },
          triangles,
          1,
        ),
      ),
    );
};
