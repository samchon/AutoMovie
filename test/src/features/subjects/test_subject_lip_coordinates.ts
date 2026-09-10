import { TestValidator } from "@nestia/e2e";

import { createPortraitLipCoordinates } from "../../subjects/generated-korean-girl-01/lipSection";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A curved smile uses local upper/lower boundaries, independent of head height.
 * Scenarios:
 * 1. A lower-band point above the mouth's global mid-height stays lower; linear
 *    sections supply hand-derived normalized coordinates and retain translation.
 * 2. Loop orientation and caller mutation cannot change bound coordinates.
 *    Corners, collapsed local bands and exterior samples remain bounded.
 * 3. Missing/nonfinite/reversed curves, mismatched inner corners, an outer span
 *    that cannot enclose the mouth and crossed inner curves refuse.
 */
export const test_subject_lip_coordinates = (): void => {
  const outer = [
    [-3, 3, 0],
    [-2, 0, 0],
    [0, -3, 0],
    [2, 0, 0],
    [3, 3, 0],
    [2, 4, 0],
    [0, 3, 0],
    [-2, 4, 0],
  ];
  const upper = [
    [-2, 2, 0],
    [0, 1, 0],
    [2, 2, 0],
  ];
  const lower = [
    [-2, 2, 0],
    [-1, 0.5, 0],
    [0, -1, 0],
    [1, 0.5, 0],
    [2, 2, 0],
  ];
  const coordinate = createPortraitLipCoordinates(outer, upper, lower);
  const point = [1.5, 0.8, 0];
  const expected = coordinate(point);
  TestValidator.equals(
    "raised lower lip remains lower",
    expected.side,
    "lower",
  );
  TestValidator.predicate(
    "curved section oracle",
    nclose(expected.lateral, 0.75) && nclose(expected.across, 0.775),
  );
  const top = coordinate([0, 2, 0]);
  TestValidator.predicate(
    "upper section oracle",
    top.side === "upper" && nclose(top.lateral, 0) && nclose(top.across, 0.5),
  );
  TestValidator.equals(
    "loop winding is independent",
    createPortraitLipCoordinates([...outer].reverse(), upper, lower)(point),
    expected,
  );
  const move = (p: number[]) => p.map((v, axis) => v + [7, -4, 9][axis]);
  TestValidator.equals(
    "frame translation",
    createPortraitLipCoordinates(
      outer.map(move),
      upper.map(move),
      lower.map(move),
    )(move(point)).side,
    expected.side,
  );
  const moved = createPortraitLipCoordinates(
    outer.map(move),
    upper.map(move),
    lower.map(move),
  )(move(point));
  TestValidator.predicate(
    "normalized translation",
    nclose(moved.lateral, expected.lateral) &&
      nclose(moved.across, expected.across),
  );
  // Positive Y values near the finite limit overflow an ordinary sum-before-
  // division mean. Their actual relative shape is unchanged and representable.
  const distant = (p: number[]) =>
    p.map((v, axis) => v * 1e307 + (axis === 1 ? 1.2e308 : 0));
  const large = createPortraitLipCoordinates(
    outer.map(distant),
    upper.map(distant),
    lower.map(distant),
  )(distant(point));
  TestValidator.predicate(
    "large finite frame preserves lip identity",
    large.side === expected.side &&
      nclose(large.lateral, expected.lateral) &&
      nclose(large.across, expected.across),
  );
  const collapsed = createPortraitLipCoordinates(
    [
      [-2, 2, 0],
      [0, -3, 0],
      [2, 2, 0],
      [0, 3, 0],
    ],
    upper,
    lower,
  );
  TestValidator.equals(
    "shared corner has no band thickness",
    collapsed([-2, 2, 0]),
    { side: "upper", lateral: -1, across: 0 },
  );
  TestValidator.equals(
    "left exterior clamps",
    coordinate([-100, 99, 0]).lateral,
    -1,
  );
  TestValidator.equals(
    "right exterior clamps",
    coordinate([100, -99, 0]).lateral,
    1,
  );
  TestValidator.equals(
    "above-band sample clamps",
    coordinate([0, 99, 0]).across,
    0,
  );
  TestValidator.equals(
    "inside-aperture sample clamps",
    coordinate([0, 0, 0]).across,
    1,
  );
  for (const [a, b, c] of [
    [outer.slice(0, 2), upper, lower],
    [outer, [], lower],
    [outer, upper, []],
    [[[NaN, 0, 0], ...outer.slice(1)], upper, lower],
    [outer, [[0, 0], ...upper.slice(1)], lower],
    [
      [
        [0, 0, 0],
        [0, 1, 0],
        [0, 2, 0],
      ],
      upper,
      lower,
    ],
    [outer, [...upper].reverse(), lower],
    [outer, [upper[0], upper[0], upper[2]], lower],
    [outer, upper, [[-2, 2, 1], ...lower.slice(1)]],
    [outer, upper, [...lower.slice(0, -1), [3, 2, 0]]],
    [outer.map((p) => [p[0] / 2, p[1], p[2]]), upper, lower],
    [outer.map((p) => [p[0] > 0 ? p[0] / 2 : p[0], p[1], p[2]]), upper, lower],
  ])
    TestValidator.predicate(
      "invalid binding refuses",
      throwsError(() => createPortraitLipCoordinates(a, b, c)),
    );
  const huge = (points: number[][]) =>
    points.map((p) => [(p[0] / 3) * Number.MAX_VALUE, p[1], p[2]]);
  TestValidator.predicate(
    "unrepresentable span refuses",
    throwsError(() =>
      createPortraitLipCoordinates(huge(outer), huge(upper), huge(lower)),
    ),
  );
  for (const p of [
    [0, 0],
    [NaN, 0, 0],
  ])
    TestValidator.predicate(
      "invalid point refuses",
      throwsError(() => coordinate(p), "finite XYZ"),
    );
  const crossed = createPortraitLipCoordinates(outer, upper, [
    lower[0],
    [0, 2, 0],
    lower[lower.length - 1],
  ]);
  TestValidator.predicate(
    "crossed lips refuse",
    throwsError(() => crossed([0, 1, 0]), "above"),
  );
  outer[0][0] = -99;
  upper[1][1] = 99;
  lower[1][1] = -99;
  TestValidator.equals("bound curves are owned", coordinate(point), expected);
};
