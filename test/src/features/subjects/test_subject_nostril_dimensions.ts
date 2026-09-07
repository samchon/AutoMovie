import { TestValidator } from "@nestia/e2e";

import {
  portraitNoseShape,
  portraitNoseSocket,
} from "../../subjects/generated-korean-girl-01/configuration";
import { createPortraitNoseComponent } from "../../subjects/generated-korean-girl-01/nose";
import { resizePortraitNostrilRim } from "../../subjects/generated-korean-girl-01/nostrilRim";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Nasal aperture dimensions act within the opening's own plane. Changing its
 * height must not change its orientation or detach it from its fitted lining.
 *
 * Scenarios:
 * 1. Doubling a square opening's height in the plane y=z doubles both Y and Z;
 *    the independent X width and the aperture plane remain unchanged. The
 *    lining's near ring uses that resized boundary and its declared cavity offset.
 * 2. A plane normal to X uses Y for width. A nonplanar XY rim retains its
 *    normal residual, translation and units under independent width/height edits.
 * 3. Unit factors return owned exact copies. Invalid points, factors, zero area
 *    and unrepresentable output refuse; finite large identity inputs remain valid.
 */
export const test_subject_nostril_dimensions = (): void => {
  const host = {
    positions: [
      [-2, -1, -1],
      [2, -1, -1],
      [2, 1, 1],
      [-2, 1, 1],
    ],
    indices: [0, 1, 2, 0, 2, 3],
    viewRay: [0, 0, 1],
  };
  const socket = {
    ...portraitNoseSocket,
    surface: [0, 1, 2, 3],
    nostrils: [[0, 1]],
  };
  const plan = createPortraitNoseComponent(socket, {
    ...portraitNoseShape,
    nostrilHeightScale: 2,
    nostrilTilt: 0,
    rimRoundness: 0,
    rimSupport: 0.1,
    cavityContraction: 0.6,
    cavityOffset: [0, 3, -5],
  }).fit(host);
  TestValidator.predicate(
    "height preserves the aperture plane",
    plan.constraints.every(({ vertex, target }) =>
      target.every((value, axis) =>
        nclose(value, host.positions[vertex][axis] * (axis === 0 ? 1 : 2)),
      ),
    ),
  );
  const cage = {
    positions: host.positions.map((p) => [...p]),
    indices: [] as number[],
    groups: [] as number[],
  };
  for (const pin of plan.constraints)
    cage.positions[pin.vertex] = [...pin.target];
  plan.attach(cage, cage.positions, () => 0);
  TestValidator.predicate(
    "lining follows the resized rim",
    cage.positions[4].every((v, i) => nclose(v, [-1.92, -1.62, -2.42][i])),
  );
  const profile = [
    [0, -1, -1],
    [0, 1, -1],
    [0, 1, 1],
    [0, -1, 1],
  ];
  TestValidator.predicate(
    "profile plane width uses Y",
    resizePortraitNostrilRim(profile, 2, 1).every((p, i) =>
      p.every((v, axis) => nclose(v, profile[i][axis] * (axis === 1 ? 2 : 1))),
    ),
  );
  const warped = [
    [-1, -1, 0.2],
    [1, -1, -0.2],
    [1, 1, 0.2],
    [-1, 1, -0.2],
  ];
  const result = resizePortraitNostrilRim(warped, 2, 3);
  TestValidator.predicate(
    "nonplanarity is retained",
    result.every((p, i) =>
      p.every((v, axis) => nclose(v, warped[i][axis] * [2, 3, 1][axis])),
    ),
  );
  const move = (p: number[]) => p.map((v, i) => 1000 * v + [7, -3, 5][i]);
  TestValidator.predicate(
    "translation and units commute",
    resizePortraitNostrilRim(warped.map(move), 2, 3).every((p, i) =>
      p.every((v, axis) => nclose(v, move(result[i])[axis], 1e-8)),
    ),
  );
  const copied = resizePortraitNostrilRim(warped, 1, 1);
  TestValidator.equals("identity is exact", copied, warped);
  copied[0][0] = 99;
  TestValidator.equals("identity owns its points", warped[0][0], -1);
  for (const factor of [0, -1, NaN, Infinity])
    for (const pair of [
      [factor, 1],
      [1, factor],
    ])
      TestValidator.predicate(
        "invalid factor refuses",
        throwsError(
          () => resizePortraitNostrilRim(warped, pair[0], pair[1]),
          "positive factors",
        ),
      );
  for (const points of [
    [],
    [
      [0, 0, 0],
      [1, 0, 0],
    ],
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
  ])
    TestValidator.predicate(
      "invalid rim refuses",
      throwsError(() => resizePortraitNostrilRim(points, 2, 1), "finite rim"),
    );
  TestValidator.predicate(
    "zero area refuses resizing",
    throwsError(
      () =>
        resizePortraitNostrilRim(
          [
            [0, 0, 0],
            [1, 0, 0],
            [2, 0, 0],
          ],
          2,
          1,
        ),
      "oriented area",
    ),
  );
  const huge = warped.map((p) => p.map((v) => v * Number.MAX_VALUE));
  TestValidator.equals(
    "large identity stays finite",
    resizePortraitNostrilRim(huge, 1, 1),
    huge,
  );
  TestValidator.predicate(
    "overflow refuses",
    throwsError(() => resizePortraitNostrilRim(huge, 2, 1), "representable"),
  );
};
