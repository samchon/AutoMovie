import {
  assertPortraitOralLining,
  buildPortraitOralLining,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitOralLiningFixture } from "../internal/portraitOralLiningFixture";
import { throwsError } from "../internal/predicates";

/**
 * Only a finite manifold rim supplies an unambiguous cavity attachment.
 *
 * Scenarios:
 * 1. Positive depth and wall endpoints pass; adjacent and nonfinite dimensions refuse.
 * 2. Missing, fractional or nonresident seeds, incomplete/nonresident triangles,
 *    repeated vertices, nonmanifold edges, equal winding and branches refuse.
 * 3. Nonfinite/incomplete points, collapsed rim edges and overflow refuse.
 */
export const test_subject_oral_lining_refusals = (): void => {
  for (const wall of [0, 0.95]) assertPortraitOralLining(0.001, wall);
  for (const depth of [0, -0.001, NaN, Infinity, Number.MAX_VALUE])
    TestValidator.predicate(
      "depth admission",
      throwsError(() => assertPortraitOralLining(depth, 0.5), "depth"),
    );
  for (const wall of [-0.001, 0.951, NaN, Infinity])
    TestValidator.predicate(
      "wall admission",
      throwsError(() => assertPortraitOralLining(10, wall), "fraction"),
    );
  const surface = portraitOralLiningFixture();
  for (const seed of [-1, 0.5, 8, NaN])
    TestValidator.predicate(
      "resident free seed",
      throwsError(
        () => buildPortraitOralLining(surface, seed, 10, 0.5),
        "seed",
      ),
    );
  for (const indices of [[0], [0, 1, -1], [0, 1, 8], [0, 1, 0.5], [0, 1, NaN]])
    TestValidator.predicate(
      "resident complete triangles",
      throwsError(
        () => buildPortraitOralLining({ ...surface, indices }, 0, 10, 0.5),
        "complete",
      ),
    );
  for (const [indices, message] of [
    [[], "seed"],
    [[0, 0, 1], "distinct"],
    [[0, 1, 2, 0, 1, 3], "opposed"],
    [[0, 1, 2, 1, 0, 3, 0, 1, 4], "manifold"],
    [[0, 1, 2, 0, 3, 4], "branch"],
  ] as const)
    TestValidator.predicate(
      "boundary topology admission",
      throwsError(
        () => buildPortraitOralLining({ ...surface, indices }, 0, 10, 0.5),
        message,
      ),
    );
  for (const point of [[NaN, 1, 0], [0, 1], surface.positions[1]]) {
    const copy = structuredClone(surface);
    copy.positions[0] = point;
    TestValidator.predicate(
      "finite noncollapsed rim",
      throwsError(() => buildPortraitOralLining(copy, 0, 10, 0.5), "rim"),
    );
  }
  const huge = {
    ...surface,
    positions: surface.positions.map(([x, y]) => [x, y, -1e308]),
  };
  TestValidator.predicate(
    "placed overflow",
    throwsError(
      () => buildPortraitOralLining(huge, 0, 8e307, 0.5),
      "representable",
    ),
  );
};
