import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitNeckShape,
  appendPortraitNeck,
} from "../../subjects/generated-korean-girl-01/cranium";
import { throwsError } from "../internal/predicates";

/**
 * Cervical placement follows its declared axis and sections rather than a
 * hidden origin in the facial coordinate frame.
 *
 * Scenarios:
 * 1. Cardinal collar points produce independently calculated upper/crop radii.
 * 2. Translating the collar and section frame in Y/Z translates every output
 *    vertex equally, including tangent guides; the shapes retain their inputs.
 * 3. Nonfinite or nonpositive dimensions, insufficient collars and sections
 *    that do not descend below the attachment are refused. A section immediately
 *    below the lowest attachment is valid while equality is refused.
 */
export const test_subject_neck_sections = (): void => {
  const roots = [
    [30, -60, -50],
    [0, -70, -30],
    [-30, -60, -50],
    [0, -30, -90],
  ];
  const exterior = roots.map(([x, y, z]) => [
    x * 1.1,
    y + 5,
    -50 + (z + 50) * 1.1,
  ]);
  const shape: IPortraitNeckShape = {
    upper: { y: -100, width: 20, front: 15, back: 25, centre: -50 },
    lower: { y: -120, width: 24, front: 17, back: 27, centre: -55 },
    crop: { y: -125, width: 25, front: 18, back: 28, centre: -60 },
  };
  const build = (input: IPortraitNeckShape, dy: number, dz: number) => {
    const translate = (point: number[]) => [
      point[0],
      point[1] + dy,
      point[2] + dz,
    ];
    const cage = {
      positions: roots.map(translate),
      indices: [] as number[],
      groups: [] as number[],
    };
    const boundary = appendPortraitNeck(
      cage,
      { boundary: [0, 1, 2, 3], exterior: exterior.map(translate) },
      input,
    );
    return { cage, boundary };
  };
  const before = structuredClone(shape);
  const { cage, boundary } = build(shape, 0, 0);
  for (const expected of [
    [
      [20, -100, -50],
      [0, -100, -35],
      [-20, -100, -50],
      [0, -100, -75],
    ],
    [
      [25, -125, -60],
      [0, -125, -42],
      [-25, -125, -60],
      [0, -125, -88],
    ],
  ] as const)
    for (let i = 0; i < 4; i++)
      TestValidator.predicate(
        "declared cardinal section",
        cage.positions.some((point) =>
          point.every(
            (value, axis) => Math.abs(value - expected[i][axis]) < 1e-10,
          ),
        ),
      );
  TestValidator.predicate(
    "crop identities",
    boundary.every((id, i) => id === cage.positions.length - 4 + i),
  );
  const translated = structuredClone(shape);
  for (const section of Object.values(translated)) {
    section.y += 17;
    section.centre += 13;
  }
  const moved = build(translated, 17, 13).cage;
  TestValidator.predicate(
    "translation preserves the complete neck",
    cage.positions.every((point, i) =>
      point.every(
        (value, axis) =>
          Math.abs(moved.positions[i][axis] - value - [0, 17, 13][axis]) <
          1e-10,
      ),
    ),
  );
  TestValidator.equals("construction retains section inputs", shape, before);
  const horizontal = {
    positions: roots.map((point) => [...point]),
    indices: [] as number[],
    groups: [] as number[],
  };
  appendPortraitNeck(
    horizontal,
    {
      boundary: [0, 1, 2, 3],
      exterior: exterior.map((point, i) => [point[0], roots[i][1], point[2]]),
    },
    shape,
  );
  for (let i = 0; i < roots.length; i++)
    TestValidator.predicate(
      "horizontal initial tangent remains valid",
      Math.abs(
        -11 * roots[i][1] +
          18 * horizontal.positions[roots.length + i][1] -
          9 * horizontal.positions[2 * roots.length + i][1] +
          2 * horizontal.positions[3 * roots.length + i][1],
      ) < 1e-10,
    );
  const bad = (mutate: (value: IPortraitNeckShape) => void): void => {
    const invalid = structuredClone(shape);
    mutate(invalid);
    TestValidator.predicate(
      "invalid cervical section refused",
      throwsError(() => build(invalid, 0, 0)),
    );
  };
  bad((value) => {
    value.upper.width = 0;
  });
  bad((value) => {
    value.lower.front = -1;
  });
  bad((value) => {
    value.crop.back = 0;
  });
  bad((value) => {
    value.upper.centre = NaN;
  });
  bad((value) => {
    value.lower.y = Infinity;
  });
  bad((value) => {
    value.crop.y = value.lower.y;
  });
  bad((value) => {
    value.lower.y = value.upper.y;
  });
  bad((value) => {
    value.upper.y = -70;
  });
  build({ ...shape, upper: { ...shape.upper, y: -70.000001 } }, 0, 0);
  for (const count of [0, 2])
    TestValidator.predicate(
      "insufficient collar refused",
      throwsError(() =>
        appendPortraitNeck(
          {
            positions: roots.map((point) => [...point]),
            indices: [],
            groups: [],
          },
          {
            boundary: [0, 1, 2, 3].slice(0, count),
            exterior: exterior.slice(0, count),
          },
          shape,
        ),
      ),
    );
};
