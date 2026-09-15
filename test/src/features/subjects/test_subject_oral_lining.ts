import { buildPortraitOralLining } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitOralLiningFixture } from "../internal/portraitOralLiningFixture";
import { nclose } from "../internal/predicates";

/**
 * An oral lining starts on the actual inner free cycle, not a reconstructed rim.
 *
 * Scenarios:
 * 1. A square annulus selects its seeded inner loop, copies its four coordinates
 *    and places the hand-calculated halfway wall and posterior pole in mm.
 * 2. Every internal edge has two opposed incidents, and the sole free boundary
 *    opposes the four skin-rim edges. All normals are unit directions.
 * 3. Zero starts the cosine taper immediately; the inclusive maximum wall is
 *    accepted. A different seed rotates ordering without changing attachment.
 * 4. Repeat construction and input ownership preserve the exact geometry.
 */
export const test_subject_oral_lining = (): void => {
  const surface = portraitOralLiningFixture(),
    saved = structuredClone(surface);
  const mesh = buildPortraitOralLining(surface, 0, 10, 0.75);
  TestValidator.equals(
    "one copied rim",
    mesh.positions.slice(0, 12),
    surface.positions.slice(0, 4).flat(),
  );
  TestValidator.equals(
    "depth rings and one pole",
    mesh.positions.length / 3,
    97,
  );
  TestValidator.equals(
    "hand halfway wall",
    mesh.positions.slice(12 * 4 * 3, 12 * 4 * 3 + 3),
    [-1, 1, -9],
  );
  TestValidator.equals(
    "hand posterior pole",
    mesh.positions.slice(-3),
    [0, 0, -18],
  );
  const incidence = new Map<string, number[]>();
  const ids = mesh.indices!;
  for (let i = 0; i < ids.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = ids[i + j],
        b = ids[i + ((j + 1) % 3)],
        key = `${Math.min(a, b)}/${Math.max(a, b)}`;
      const values = incidence.get(key) ?? [];
      values.push(a < b ? 1 : -1);
      incidence.set(key, values);
    }
  const boundary = [...incidence.entries()].filter(
    ([, values]) => values.length === 1,
  );
  TestValidator.equals(
    "only four free rim edges",
    boundary.map(([key]) => key).sort((a, b) => a.localeCompare(b)),
    ["0/1", "0/3", "1/2", "2/3"],
  );
  TestValidator.predicate(
    "opposed internal winding",
    [...incidence.values()].every(
      (v) => v.length === 1 || (v.length === 2 && v[0] + v[1] === 0),
    ),
  );
  for (const [key, sign] of [
    ["0/1", -1],
    ["1/2", -1],
    ["2/3", -1],
    ["0/3", 1],
  ] as const)
    TestValidator.equals("opposes skin", incidence.get(key), [sign]);
  TestValidator.predicate(
    "unit normals",
    mesh.normals!.every(
      (_v, i, values) =>
        i % 3 !== 0 ||
        nclose(Math.hypot(values[i], values[i + 1], values[i + 2]), 1),
    ),
  );
  const tapered = buildPortraitOralLining(surface, 0, 10, 0);
  TestValidator.predicate(
    "half depth cosine radius",
    nclose(tapered.positions[12 * 4 * 3], -Math.SQRT1_2),
  );
  buildPortraitOralLining(surface, 0, 10, 0.95);
  TestValidator.equals(
    "another rim seed",
    buildPortraitOralLining(surface, 2, 10, 0.75).positions.slice(0, 3),
    surface.positions[2],
  );
  TestValidator.equals(
    "repeat geometry",
    buildPortraitOralLining(surface, 0, 10, 0.75),
    mesh,
  );
  TestValidator.equals("source ownership", surface, saved);
  mesh.positions[0] = 999;
  TestValidator.equals("returned mesh owns its coordinates", surface, saved);
};
