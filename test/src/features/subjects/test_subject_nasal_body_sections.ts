import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitNasalBodyShape,
  createPortraitNasalBody,
  portraitNasalViewRay,
} from "../../subjects/generated-korean-girl-01/nasalBody";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Longitudinal and transverse sections own real connected nasal volumes while
 * the projection ray gives depth edits a frame independent of observed image XY.
 *
 * Scenarios:
 * 1. Separate midline/shoulder/ala/crease witnesses give hand-known extents and
 *    signed lateral support. One left fullness change leaves the right exact.
 * 2. Harmonic cubic slopes retain monotone bounds and signed symmetry; empty
 *    profiles, compact boundaries and caller-data ownership retain identity.
 * 3. Large finite station spacing remains valid, while invalid shape domains,
 *    numerical overflows and absent profiles with active controls refuse.
 * 4. Axial/oblique/scaled recorded rows yield an orthogonal image-depth ray;
 *    dependent, zero or malformed rows refuse.
 */
export const test_subject_nasal_body_sections = (): void => {
  const shape: IPortraitNasalBodyShape = {
    stations: [
      { height: 0, centre: 0, shoulder: 0, ala: 0 },
      { height: 1, centre: 1, shoulder: 2, ala: 3 },
      { height: 2, centre: 0, shoulder: 0, ala: 0 },
    ],
    centreWidth: 2,
    shoulderOffset: 4,
    shoulderWidth: 2,
    alarOffset: 8,
    alarWidth: 2,
    fullness: [-0.5, 0.5],
    spread: [0.3, 0.4],
    creaseOffset: 2,
    creaseWidth: 1,
    crease: [0.1, 0.2],
  };
  const sample = createPortraitNasalBody(shape);
  for (const [x, forward, lateral] of [
    [0, 1, 0],
    [4, 2, 0],
    [8, 3.5, 0.4],
    [-8, 2.5, -0.3],
    [10, -0.2, 0],
    [-10, -0.1, 0],
  ]) {
    const value = sample(x, 1);
    TestValidator.predicate(
      "section owners reach independent hand-known witnesses",
      nclose(value.forward, forward) && nclose(value.lateral, lateral),
    );
  }
  TestValidator.predicate(
    "half station retains the authored smooth profile",
    nclose(sample(8, 0.5).forward, 1.75),
  );
  const alternate = createPortraitNasalBody({ ...shape, fullness: [-0.5, 1] });
  TestValidator.predicate(
    "one left anatomical control has its exact local effect",
    nclose(alternate(8, 1).forward - sample(8, 1).forward, 0.5),
  );
  TestValidator.equals(
    "opposite alar body stays exact",
    alternate(-8, 1),
    sample(-8, 1),
  );
  for (const y of [-1, 0, 2, 3])
    TestValidator.equals("longitudinal outer join is zero", sample(0, y), {
      lateral: 0,
      forward: 0,
    });
  TestValidator.equals("transverse exterior stays zero", sample(20, 1), {
    lateral: 0,
    forward: 0,
  });
  const saved = sample(0, 1);
  shape.stations[1].centre = 99;
  TestValidator.equals(
    "part owns a snapshot of its authored rows",
    sample(0, 1),
    saved,
  );
  for (const sign of [-1, 1]) {
    const stations = [0, 1, 2, 0].map((value, height) => ({
      height,
      centre: sign * value,
      shoulder: 0,
      ala: 0,
    }));
    const one = createPortraitNasalBody({
      ...shape,
      stations,
      fullness: [0, 0],
      spread: [0, 0],
      crease: [0, 0],
    });
    TestValidator.predicate(
      "same-sign harmonic slopes retain the hand cubic",
      nclose(one(0, 1.5).forward, sign * 1.625),
    );
    for (let i = 0; i <= 32; i++)
      TestValidator.predicate(
        "monotone interval stays inside its section endpoints",
        sign * one(0, 1 + i / 32).forward >= 1 - 1e-12 &&
          sign * one(0, 1 + i / 32).forward <= 2 + 1e-12,
      );
    const extent = Number.MAX_VALUE / 3;
    const huge = createPortraitNasalBody({
      ...shape,
      stations: stations.map((station, i) => ({
        ...station,
        height: [-Number.MAX_VALUE, -extent, extent, Number.MAX_VALUE][i],
      })),
      fullness: [0, 0],
      spread: [0, 0],
      crease: [0, 0],
    });
    TestValidator.predicate(
      "normalized harmonic weights survive huge finite spans",
      nclose(huge(0, 0).forward, sign * 1.625),
    );
  }
  const empty = shape.stations.map((station) => ({
    ...station,
    centre: 0,
    shoulder: 0,
    ala: 0,
  }));
  TestValidator.equals(
    "empty volume is identity",
    createPortraitNasalBody({
      ...shape,
      stations: empty,
      fullness: [0, 0],
      spread: [0, 0],
      crease: [0, 0],
    })(0, 1),
    { lateral: 0, forward: 0 },
  );
  TestValidator.predicate(
    "absent alar profile cannot hide an active control",
    throwsError(
      () => createPortraitNasalBody({ ...shape, stations: empty }),
      "absent alar profile",
    ),
  );
  for (const changes of [
    { stations: [] },
    { stations: new Array(33).fill(shape.stations[0]) },
    { centreWidth: 0 },
    { alarWidth: Infinity },
    { shoulderOffset: -1 },
    { fullness: [0] },
    { spread: [0] },
    { crease: [0] },
    { fullness: [NaN, 0] },
    { stations: [shape.stations[0], shape.stations[0]] },
    {
      stations: [
        { ...shape.stations[0], height: NaN },
        ...shape.stations.slice(1),
      ],
    },
  ])
    TestValidator.predicate(
      "invalid section domain refuses",
      throwsError(
        () =>
          createPortraitNasalBody({
            ...shape,
            ...changes,
          } as IPortraitNasalBodyShape),
        "ordered finite stations",
      ),
    );
  TestValidator.predicate(
    "nonzero exterior endpoint refuses",
    throwsError(
      () =>
        createPortraitNasalBody({
          ...shape,
          stations: [
            { ...shape.stations[0], centre: 1 },
            ...shape.stations.slice(1),
          ],
        }),
      "zero endpoint",
    ),
  );
  for (const stations of [
    [
      { height: -Number.MAX_VALUE, centre: 0, shoulder: 0, ala: 0 },
      { height: Number.MAX_VALUE, centre: 0, shoulder: 0, ala: 0 },
    ],
    [
      { height: 0, centre: 0, shoulder: 0, ala: 0 },
      {
        height: Number.MIN_VALUE,
        centre: Number.MAX_VALUE,
        shoulder: 0,
        ala: 0,
      },
      { height: 1, centre: 0, shoulder: 0, ala: 0 },
    ],
  ])
    TestValidator.predicate(
      "unrepresentable spacing or secant refuses",
      throwsError(
        () => createPortraitNasalBody({ ...shape, stations }),
        "spacing",
      ),
    );
  TestValidator.predicate(
    "nonfinite query refuses",
    throwsError(() => sample(NaN, 1), "finite coordinates"),
  );
  const overflow = createPortraitNasalBody({
    ...shape,
    shoulderOffset: 0,
    alarOffset: 0,
    stations: [
      shape.stations[0],
      { height: 1, centre: 1e308, shoulder: 1e308, ala: 1e308 },
      shape.stations[2],
    ],
  });
  TestValidator.predicate(
    "combined nonrepresentable volume refuses",
    throwsError(() => overflow(0, 1), "extent"),
  );
  TestValidator.equals(
    "axial image frame has axial depth",
    portraitNasalViewRay([1, 0, 0], [0, 1, 0]),
    [0, 0, 1],
  );
  for (const scale of [1, 1e160]) {
    const a = [scale, 0, -scale],
      b = [0, scale, 0],
      ray = portraitNasalViewRay(a, b);
    TestValidator.predicate(
      "recorded image rows define one perpendicular ray",
      nclose(ray[0], Math.SQRT1_2) &&
        nclose(ray[1], 0) &&
        nclose(ray[2], Math.SQRT1_2),
    );
  }
  for (const rows of [
    [
      [1, 0],
      [0, 1, 0],
    ],
    [
      [NaN, 0, 0],
      [0, 1, 0],
    ],
  ])
    TestValidator.predicate(
      "malformed image rows refuse",
      throwsError(
        () => portraitNasalViewRay(rows[0], rows[1]),
        "finite three-component",
      ),
    );
  for (const rows of [
    [
      [0, 0, 0],
      [0, 1, 0],
    ],
    [
      [1, 0, 0],
      [2, 0, 0],
    ],
  ])
    TestValidator.predicate(
      "dependent image rows refuse",
      throwsError(
        () => portraitNasalViewRay(rows[0], rows[1]),
        "independent image axes",
      ),
    );
};
