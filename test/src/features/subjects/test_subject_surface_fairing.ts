import { TestValidator } from "@nestia/e2e";

import { fairPortraitSurface } from "../../subjects/portraitSurfaceFairing";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A labelled join solves its bending energy while preserving shared boundaries.
 *
 * Scenarios:
 * 1. Four triangles around the centre of a five-by-five planar grid own one
 *    interior peak. Fixed surrounding heights are two; the only zero-energy
 *    solution restores that centre to two, independent of its starting height.
 * 2. No join and a boundary-only group return no proposals. An already planar
 *    join converges with zero work; a displaced join refuses that same limit.
 * 3. Oblique rays preserve x-z and scaled rays give the same proposal. Invalid
 *    identities, ray/dimensions, work limits and collapsed support refuse.
 * 4. Nine independently displaced interior points require multiple iterations
 *    and recover the surrounding plane; a one-step budget refuses that solve.
 */
export const test_subject_surface_fairing = (): void => {
  const positions: number[][] = [],
    indices: number[] = [],
    groups: number[] = [];
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++) positions.push([x, y, 2]);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      const a = y * 5 + x;
      for (const tri of [
        [a, a + 1, a + 6],
        [a, a + 6, a + 5],
      ]) {
        indices.push(...tri);
        groups.push(tri.includes(12) ? 1 : 0);
      }
    }
  const host = { positions, indices, groups, normals: [] };
  positions[12][2] = 3;
  const result = fairPortraitSurface(host, 1, [0, 0, 1]);
  TestValidator.equals(
    "one interior owner",
    result.map((r) => r.vertex),
    [12],
  );
  TestValidator.predicate(
    "independent plane solution",
    nclose(result[0].target[2], 2),
  );
  TestValidator.equals("input peak retained", positions[12], [0, 0, 3]);
  const oblique = fairPortraitSurface(host, 1, [1, 0, 1]);
  TestValidator.predicate(
    "image plane retained",
    nclose(oblique[0].target[0] - oblique[0].target[2], -3),
  );
  const scaled = fairPortraitSurface(host, 1, [3, 0, 3]);
  TestValidator.predicate(
    "ray magnitude is not shape",
    oblique[0].target.every((v, i) => nclose(v, scaled[0].target[i])),
  );
  TestValidator.equals(
    "absent group",
    fairPortraitSurface(host, 8, [0, 0, 1]),
    [],
  );
  const boundaryOnly = {
    ...host,
    groups: groups.map((_, i) => (i === 0 ? 2 : 0)),
  };
  TestValidator.equals(
    "boundary only",
    fairPortraitSurface(boundaryOnly, 2, [0, 0, 1]),
    [],
  );
  TestValidator.predicate(
    "unfinished solve refuses",
    throwsError(() => fairPortraitSurface(host, 1, [0, 0, 1], 0)),
  );
  for (const ray of [[], [0, 0, 0], [0, NaN, 1]])
    TestValidator.predicate(
      "invalid ray",
      throwsError(() => fairPortraitSurface(host, 1, ray)),
    );
  for (const group of [-1, 0.5, NaN])
    TestValidator.predicate(
      "invalid group",
      throwsError(() => fairPortraitSurface(host, group, [0, 0, 1])),
    );
  for (const limit of [-1, 0.5, Infinity])
    TestValidator.predicate(
      "invalid work limit",
      throwsError(() => fairPortraitSurface(host, 1, [0, 0, 1], limit)),
    );
  for (const bad of [
    { ...host, groups: [] },
    { ...host, indices: [-1, ...indices.slice(1)] },
    { ...host, indices: [positions.length, ...indices.slice(1)] },
    { ...host, indices: [0.5, ...indices.slice(1)] },
    { ...host, positions: positions.map((p, i) => (i === 12 ? [0, 0] : p)) },
    {
      ...host,
      positions: positions.map((p, i) => (i === 12 ? [0, 0, NaN] : p)),
    },
    { ...host, positions: positions.map(() => [0, 0, 0]) },
    { ...host, positions: positions.map((p) => p.map((v) => v * 1e200)) },
  ])
    TestValidator.predicate(
      "invalid support",
      throwsError(() => fairPortraitSurface(bad, 1, [0, 0, 1])),
    );
  positions[12][2] = 2;
  TestValidator.predicate(
    "stationary plane needs no iterations",
    nclose(fairPortraitSurface(host, 1, [0, 0, 1], 0)[0].target[2], 2),
  );
  const many = {
    positions: [] as number[][],
    indices: [] as number[],
    groups: [] as number[],
    normals: [],
  };
  for (let y = -3; y <= 3; y++)
    for (let x = -3; x <= 3; x++)
      many.positions.push([
        x,
        y,
        Math.abs(x) < 2 && Math.abs(y) < 2 ? 3 + x * 0.3 + y * 0.2 : 2,
      ]);
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 6; x++) {
      const a = y * 7 + x;
      many.indices.push(a, a + 1, a + 8, a, a + 8, a + 7);
      const label = x >= 1 && x <= 4 && y >= 1 && y <= 4 ? 1 : 0;
      many.groups.push(label, label);
    }
  TestValidator.predicate(
    "one step cannot finish coupled solve",
    throwsError(() => fairPortraitSurface(many, 1, [0, 0, 1], 1)),
  );
  const coupled = fairPortraitSurface(many, 1, [0, 0, 1]);
  TestValidator.equals("nine interior unknowns", coupled.length, 9);
  TestValidator.predicate(
    "coupled plane recovered",
    coupled.every((r) => nclose(r.target[2], 2)),
  );
};
