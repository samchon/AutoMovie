import { TestValidator } from "@nestia/e2e";

import type { IPortraitNasalBodyShape } from "../../subjects/generated-korean-girl-01/nasalBody";
import { createPortraitNasalBodySurface } from "../../subjects/generated-korean-girl-01/nasalBodySurface";
import { applyPortraitFinalSurfaces } from "../../subjects/portraitFinalSurface";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Refined exterior volume preserves an independently attached nasal boundary,
 * with a physical zero-slope join and an unchanged posterior surface.
 *
 * Scenarios:
 * 1. A square lining and four-mm plateau give a two-mm displacement halfway
 *    through a two-mm join. Shared rim and interior positions stay exact.
 * 2. Near-rim displacement is quadratic, far depth and empty volume are identity,
 *    and translated data, caller mutation and provider order preserve ownership.
 * 3. Invalid identities/rays/distances, missing datum/lining and degenerate or
 *    nonrepresentable boundary edges refuse beside their valid neighbours.
 */
export const test_subject_nasal_body_surface = (): void => {
  const shape: IPortraitNasalBodyShape = {
    stations: [0, 1, 3, 4].map((height, i) => ({
      height,
      centre: i === 0 || i === 3 ? 0 : 4,
      shoulder: 0,
      ala: 0,
    })),
    centreWidth: 3,
    shoulderOffset: 4,
    shoulderWidth: 1,
    alarOffset: 8,
    alarWidth: 1,
    fullness: [0, 0],
    spread: [0, 0],
    creaseOffset: 1,
    creaseWidth: 1,
    crease: [0, 0],
  };
  const mesh = {
    positions: [
      [-1, -1, 0],
      [1, -1, 0],
      [1, 1, 0],
      [-1, 1, 0],
      [0, 0, 0],
      [0, 2, 0],
      [0, 2, -10],
      [0, 1.00001, 0],
      [20, 2, 0],
    ],
    indices: [0, 1, 2, 0, 2, 3, 3, 2, 5],
    groups: [1, 1, 0],
  };
  const propose = createPortraitNasalBodySurface(shape, 4, 1, [0, 0, 2], 2, 10);
  const result = applyPortraitFinalSurfaces(mesh, [{ id: "nose", propose }]);
  TestValidator.predicate(
    "hand-known cubic join gives two millimetres",
    nclose(result.positions[5][2], 2),
  );
  for (const id of [0, 1, 2, 3, 4, 6, 8])
    TestValidator.equals(
      "rim, empty volume and posterior remain exact",
      result.positions[id],
      mesh.positions[id],
    );
  TestValidator.predicate(
    "zero physical derivative at the rim",
    nclose(result.positions[7][2] / 1e-10, 3, 2e-5),
  );
  const saved = result.positions[5];
  shape.stations[1].centre = 40;
  TestValidator.equals(
    "surface owns its numerical body",
    applyPortraitFinalSurfaces(mesh, [{ id: "nose", propose }]).positions[5],
    saved,
  );
  shape.stations[1].centre = 4;
  const shift = [4, -3, 7];
  const shifted = {
    ...mesh,
    positions: mesh.positions.map((p) => p.map((v, i) => v + shift[i])),
  };
  const translated = applyPortraitFinalSurfaces(shifted, [
    { id: "nose", propose },
  ]);
  TestValidator.predicate(
    "one group translation preserves local shape",
    translated.positions[5].every((v, i) => nclose(v, saved[i] + shift[i])),
  );
  const invalid: [number, number, number[], number, number][] = [
    [-1, 1, [0, 0, 1], 2, 10],
    [0.5, 1, [0, 0, 1], 2, 10],
    [4, -1, [0, 0, 1], 2, 10],
    [4, 0.5, [0, 0, 1], 2, 10],
    [4, 1, [0, 1], 2, 10],
    [4, 1, [NaN, 0, 1], 2, 10],
    [4, 1, [0, 0, 0], 2, 10],
    [4, 1, [Number.MAX_VALUE, Number.MAX_VALUE, 0], 2, 10],
    [4, 1, [0, 0, 1], 0, 10],
    [4, 1, [0, 0, 1], 2, Infinity],
  ];
  for (const args of invalid)
    TestValidator.predicate(
      "invalid final body frame refuses",
      throwsError(
        () => createPortraitNasalBodySurface(shape, ...args),
        "positive joining",
      ),
    );
  const run = (value: typeof mesh, datum = 4, group = 1) =>
    applyPortraitFinalSurfaces(value, [
      {
        id: "nose",
        propose: createPortraitNasalBodySurface(
          shape,
          datum,
          group,
          [0, 0, 1],
          2,
          10,
        ),
      },
    ]);
  TestValidator.predicate(
    "missing retained datum refuses",
    throwsError(() => run(mesh, 99), "retained tip"),
  );
  TestValidator.predicate(
    "missing lining refuses",
    throwsError(() => run(mesh, 4, 9), "lining boundary"),
  );
  for (const first of [
    [1, -1, 0],
    [Number.MAX_VALUE, -1, 0],
  ])
    TestValidator.predicate(
      "degenerate or overflowing boundary refuses",
      throwsError(
        () => run({ ...mesh, positions: [first, ...mesh.positions.slice(1)] }),
        "nonzero edges",
      ),
    );
};
