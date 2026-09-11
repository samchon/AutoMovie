import { TestValidator } from "@nestia/e2e";

import { blendPortraitSkin } from "../../subjects/blendPortraitSkin";
import type { IPortraitSkinConstraint } from "../../subjects/portraitComponents";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Component attachment positions are exact while surrounding skin adapts by
 * mesh connectivity. The equal-distance centre of a four-corner fan supplies
 * an independent harmonic oracle: one 4 mm corner lift gives a 1 mm centre lift.
 *
 * Scenarios:
 * 1. Pin all four corners, lift one by 4 mm, and check the centre mean and exact pins.
 * 2. A nearby disconnected marker and a distant connected vertex remain fixed.
 * 3. Reordering attachments and repeating an identical pin retain the solution;
 *    an empty edit and a zero-reach edit leave unpinned positions unchanged.
 * 4. Conflicting pins, invalid vertex identities, invalid XYZ and invalid reach
 *    are refused. Coincident connected vertices still produce finite values.
 */
export const test_subject_skin_attachment_blend = (): void => {
  const points = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [-1, 0, 0],
    [0, -1, 0],
    [0, 0, 0],
    [10, 0, 0],
  ];
  const indices = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 1, 6, 2];
  const pins = [1, 2, 3, 4].map((vertex) => ({
    vertex,
    target: points[vertex].map((value, axis) =>
      axis === 2 && vertex === 1 ? 4 : value,
    ),
    reach: 2,
  }));
  const result = blendPortraitSkin(points, indices, pins);
  TestValidator.predicate("harmonic centre", nclose(result[0][2], 1));
  TestValidator.equals("exact attachment", result[1], [1, 0, 4]);
  TestValidator.equals("nearby disconnected marker", result[5], points[5]);
  TestValidator.equals("outside geodesic reach", result[6], points[6]);
  TestValidator.equals("input was not edited", points[1], [1, 0, 0]);
  TestValidator.equals(
    "order does not change skin",
    blendPortraitSkin(points, indices, [...pins].reverse()),
    result,
  );
  TestValidator.equals(
    "same pin can be shared",
    blendPortraitSkin(points, indices, [...pins, pins[0]]),
    result,
  );
  TestValidator.equals(
    "empty edit",
    blendPortraitSkin(points, indices, []),
    points,
  );
  const local = blendPortraitSkin(points, indices, [{ ...pins[0], reach: 0 }]);
  TestValidator.equals(
    "zero reach fixes only attachment",
    [local[0], local[1]],
    [points[0], [1, 0, 4]],
  );
  TestValidator.predicate(
    "conflicting parts refused",
    throwsError(() =>
      blendPortraitSkin(points, indices, [
        ...pins,
        { ...pins[0], target: [1, 0, 3] },
      ]),
    ),
  );
  const invalid: IPortraitSkinConstraint[] = [
    { ...pins[0], vertex: -1 },
    { ...pins[0], vertex: points.length },
    { ...pins[0], vertex: 0.5 },
    { ...pins[0], target: [1, 2] },
    { ...pins[0], target: [1, 2, NaN] },
    { ...pins[0], reach: -1 },
    { ...pins[0], reach: Infinity },
  ];
  for (const pin of invalid)
    TestValidator.predicate(
      "invalid attachment refused",
      throwsError(() => blendPortraitSkin(points, indices, [pin])),
    );
  const coincident = blendPortraitSkin(
    [
      [0, 0, 0],
      [0, 0, 0],
      [1, 0, 0],
    ],
    [0, 1, 2],
    [{ vertex: 0, target: [0, 0, 1], reach: 2 }],
  );
  TestValidator.predicate(
    "coincident edge stays finite",
    coincident.flat().every(Number.isFinite),
  );
  // A long strip uses the finite refinement budget. Positive averaging must
  // retain the boundary maximum principle before full harmonic convergence.
  const strip = Array.from({ length: 31 }, (_, x) => [
    [x, 0, 0],
    [x, 1, 0],
  ]).flat();
  const triangles: number[] = [];
  for (let x = 0; x < 30; x++)
    triangles.push(
      2 * x,
      2 * x + 2,
      2 * x + 1,
      2 * x + 1,
      2 * x + 2,
      2 * x + 3,
    );
  const stripPins = [0, 1, 60, 61].map((vertex) => ({
    vertex,
    target: [...strip[vertex].slice(0, 2), vertex < 2 ? 0 : 1],
    reach: 100,
  }));
  const extended = blendPortraitSkin(strip, triangles, stripPins);
  TestValidator.predicate(
    "extended field stays within fixed heights",
    extended.every((point) => point[2] >= 0 && point[2] <= 1),
  );
  TestValidator.predicate(
    "extended field transmits movement",
    extended[30][2] > 0.25 && extended[30][2] < 0.75,
  );
};
