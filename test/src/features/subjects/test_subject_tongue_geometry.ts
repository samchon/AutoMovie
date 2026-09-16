import { validateMeshTopology } from "@automovie/engine";
import { buildPortraitTongue } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitTongueFixture } from "../internal/portraitTongueFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The tongue is a closed volume with independent dorsal and anterior motion.
 *
 * Scenarios:
 * 1. A sampled body is closed and outward, with hand-calculated mid-ring axes,
 *    dorsal groove, unchanged underside, unit normals and two shared poles.
 * 2. Eight millimetres of rise and six of advance move the mid-body by 8/3 mm,
 *    move the tip only anteriorly, and leave the posterior pole fixed.
 * 3. Difference limits admit; adjacent/nonfinite values and a longitudinal
 *    retraction reversal refuse, while the neighbouring longer body admits.
 */
export const test_subject_tongue_geometry = (): void => {
  const shape = portraitTongueFixture(),
    mesh = buildPortraitTongue(shape);
  TestValidator.predicate(
    "closed outward body",
    validateMeshTopology({ mesh, expectClosed: true }).success,
  );
  const point = (row: number, col: number) =>
    mesh.positions.slice(
      (1 + (row - 1) * 48 + col) * 3,
      (2 + (row - 1) * 48 + col) * 3,
    );
  for (const [col, expected] of [
    [0, [18, 3, -21.5]],
    [12, [0, 7.35, -21.5]],
    [24, [-18, 3, -21.5]],
    [36, [0, -2, -21.5]],
  ] as const)
    TestValidator.predicate(
      "independent mid-body section",
      point(16, col).every((v, i) => nclose(v, expected[i])),
    );
  TestValidator.equals("anterior pole", mesh.positions.slice(0, 3), [0, 0, 0]);
  TestValidator.equals("posterior pole", mesh.positions.slice(-3), [0, 0, -43]);
  for (let i = 0; i < mesh.normals!.length; i += 3)
    TestValidator.predicate(
      "unit resident normal",
      nclose(Math.hypot(...mesh.normals!.slice(i, i + 3)), 1),
    );
  const changed = buildPortraitTongue(shape, { raise: 8, advance: 6 });
  const mid = (1 + 15 * 48 + 12) * 3;
  TestValidator.predicate(
    "independent dorsal and anterior deltas",
    nclose(changed.positions[mid + 1] - mesh.positions[mid + 1], 8) &&
      nclose(changed.positions[mid + 2] - mesh.positions[mid + 2], 3),
  );
  TestValidator.equals(
    "anterior advance",
    changed.positions.slice(0, 3),
    [0, 0, 6],
  );
  TestValidator.equals(
    "fixed posterior",
    changed.positions.slice(-3),
    mesh.positions.slice(-3),
  );
  TestValidator.equals(
    "same input same mesh",
    buildPortraitTongue(shape),
    mesh,
  );
  for (const value of [-16, 16])
    buildPortraitTongue(shape, { raise: value, advance: value });
  for (const key of ["raise", "advance"] as const)
    for (const value of [-16.001, 16.001, NaN, Infinity])
      TestValidator.predicate(
        "invalid performance difference",
        throwsError(
          () =>
            buildPortraitTongue(shape, { raise: 0, advance: 0, [key]: value }),
          "differences",
        ),
      );
  TestValidator.predicate(
    "no retraction reversal",
    throwsError(
      () =>
        buildPortraitTongue(
          { ...shape, length: 24 },
          { raise: 0, advance: -16 },
        ),
      "longitudinal",
    ),
  );
  buildPortraitTongue({ ...shape, length: 24.001 }, { raise: 0, advance: -16 });
};
