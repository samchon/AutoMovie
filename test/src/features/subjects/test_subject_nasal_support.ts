import { TestValidator } from "@nestia/e2e";

import { createPortraitNasalSupport } from "../../subjects/generated-korean-girl-01/nasalSupport";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Nasal projection is measured from a shared attachment plane, not world zero.
 * The hand plane z=y/2 makes translation, ratio and stationary support explicit.
 *
 * Scenarios:
 * 1. A point 4 mm above z=y/2 moves -2 mm at half projection, +4 mm at double.
 *    All three support datums stay fixed; translation preserves displacement.
 * 2. Omitted/one scale needs no plane and is identity. Input data is owned.
 * 3. Nonpositive/nonfinite scales, malformed/degenerate planes, invalid queries
 *    and unrepresentable arithmetic refuse rather than inventing another base.
 */
export const test_subject_nasal_support = (): void => {
  const points = [
    [0, 0, 0],
    [10, 0, 0],
    [0, 10, 5],
  ];
  const sample = createPortraitNasalSupport(points, 0.5);
  TestValidator.predicate("half projection", nclose(sample([2, 2, 5]), -2));
  TestValidator.predicate(
    "double projection",
    nclose(createPortraitNasalSupport(points, 2)([2, 2, 5]), 4),
  );
  for (const point of points)
    TestValidator.equals("support fixed", sample(point), 0);
  const shift = [4, -6, 12];
  TestValidator.predicate(
    "translated frame",
    nclose(
      createPortraitNasalSupport(
        points.map((p) => p.map((v, i) => v + shift[i])),
        0.5,
      )([6, -4, 17]),
      -2,
    ),
  );
  points[1][2] = 100;
  TestValidator.predicate("owned support", nclose(sample([2, 2, 5]), -2));
  TestValidator.equals("omitted ratio", createPortraitNasalSupport([])([]), 0);
  TestValidator.equals(
    "explicit one",
    createPortraitNasalSupport([], 1)([2, 2, 5]),
    0,
  );
  for (const ratio of [0, -1, NaN, Infinity])
    TestValidator.predicate(
      "ratio refusal",
      throwsError(() => createPortraitNasalSupport([], ratio)),
    );
  for (const plane of [
    [],
    [[0, 0, 0]],
    [
      [0, 0, 0],
      [1, 2],
      [2, 3, 4],
    ],
    [
      [0, 0, 0],
      [1, NaN, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
    ],
    [
      [Number.MAX_VALUE, 0, 0],
      [-Number.MAX_VALUE, 1, 0],
      [0, 0, 1],
    ],
  ])
    TestValidator.predicate(
      "plane refusal",
      throwsError(() => createPortraitNasalSupport(plane, 0.5)),
    );
  for (const point of [
    [0, 0],
    [0, NaN, 0],
  ])
    TestValidator.predicate(
      "query refusal",
      throwsError(() => sample(point)),
    );
  TestValidator.predicate(
    "finite output required",
    throwsError(() =>
      createPortraitNasalSupport(
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        Number.MAX_VALUE,
      )([0, 0, Number.MAX_VALUE]),
    ),
  );
};
