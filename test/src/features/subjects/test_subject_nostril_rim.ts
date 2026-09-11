import { TestValidator } from "@nestia/e2e";

import { fitPortraitNostrilRim } from "../../subjects/generated-korean-girl-01/nostrilRim";
import { throwsError } from "../internal/predicates";

/**
 * Rim regularization retains centroid, cyclic ownership and the boundary's
 * physical frame; fitting it cannot depend on global head axes.
 *
 * Scenarios:
 * 1. A unit circle's cardinal vertices stay fixed; a nonuniform planar rim
 *    retains its centroid and plane while a half blend lies between its ends.
 * 2. A rigid axis permutation and translation commute with the fit; zero blend
 *    returns owned copies without modifying the caller's points.
 * 3. Invalid amounts, incomplete/nonfinite loops, zero area and an output that
 *    cannot fit within finite coordinates are refused.
 */
export const test_subject_nostril_rim = (): void => {
  const near = (a: number[][], b: number[][]): boolean =>
    a.every((point, i) =>
      point.every((value, axis) => Math.abs(value - b[i][axis]) < 1e-10),
    );
  const circle = [
    [-1, 0, 0],
    [0, -1, 0],
    [1, 0, 0],
    [0, 1, 0],
  ];
  TestValidator.predicate(
    "cardinal circle remains fixed",
    near(fitPortraitNostrilRim(circle, 1), circle),
  );
  const points = [
      [0, 0, 3],
      [2, 0, 3],
      [0, 2, 3],
      [0, 1, 3],
    ],
    before = structuredClone(points);
  const full = fitPortraitNostrilRim(points, 1),
    half = fitPortraitNostrilRim(points, 0.5);
  TestValidator.predicate(
    "independent half blend",
    near(
      half,
      points.map((point, i) =>
        point.map((value, axis) => (value + full[i][axis]) / 2),
      ),
    ),
  );
  for (let axis = 0; axis < 3; axis++)
    TestValidator.predicate(
      "centroid remains fixed",
      Math.abs(
        full.reduce((sum, point) => sum + point[axis], 0) -
          points.reduce((sum, point) => sum + point[axis], 0),
      ) < 1e-10,
    );
  TestValidator.predicate(
    "fitted plane retained",
    full.every((point) => Math.abs(point[2] - 3) < 1e-10),
  );
  const move = (point: number[]) => [
    2 * point[2] + 7,
    2 * point[0] - 2,
    2 * point[1] + 4,
  ];
  TestValidator.predicate(
    "rigid frame and scale equivariance",
    near(fitPortraitNostrilRim(points.map(move), 1), full.map(move)),
  );
  const copy = fitPortraitNostrilRim(points, 0);
  copy[0][0] = 100;
  TestValidator.equals("caller inputs retained", points, before);
  for (const amount of [-0.1, 1.1, NaN])
    TestValidator.predicate(
      "invalid blend refused",
      throwsError(() => fitPortraitNostrilRim(points, amount)),
    );
  for (const loop of [
    [],
    points.slice(0, 2),
    [
      [0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [NaN, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ],
    [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
  ])
    TestValidator.predicate(
      "invalid rim refused",
      throwsError(() => fitPortraitNostrilRim(loop, 1)),
    );
  const maximum = Number.MAX_VALUE;
  TestValidator.predicate(
    "unrepresentable fitted output refused",
    throwsError(() =>
      fitPortraitNostrilRim(
        [
          [0, 0, 0],
          [maximum, 0, 0],
          [0, maximum, 0],
          [0, maximum / 2, 0],
        ],
        1,
      ),
    ),
  );
};
