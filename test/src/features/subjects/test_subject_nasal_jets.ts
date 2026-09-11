import { TestValidator } from "@nestia/e2e";

import {
  portraitNasalJetCorrection,
  samplePortraitNasalSection,
} from "../../subjects/generated-korean-girl-01/nasalAperture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The exterior and vestibular section use one position/derivative jet in a
 * physical millimetre frame, rather than independently smoothing a shared point.
 *
 * Scenarios:
 * 1. Hand-known affine and quadratic curves retain values and physical slopes;
 *    translating the datum and reversing the section preserve those relations.
 * 2. Signed boundary correction has one shared derivative, exact seam value and
 *    zero value/slope at its far end. Cubic values stay in their control hull.
 * 3. Invalid dimensions/parameters/jets and nonrepresentable tangent controls or
 *    derivatives refuse, while exact endpoints remain exact copied jets.
 */
export const test_subject_nasal_jets = (): void => {
  const left = { point: [0, 0, 0], derivative: [1, 0, 0] };
  const right = { point: [2, 4, 0], derivative: [1, 4, 0] };
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const value = samplePortraitNasalSection(left, right, 2, t),
      x = 2 * t;
    TestValidator.predicate(
      "quadratic values are hand-derived",
      value.point.every((v, axis) => nclose(v, [x, x * x, 0][axis])),
    );
    TestValidator.predicate(
      "derivative uses physical distance",
      value.derivative.every((v, axis) => nclose(v, [1, 2 * x, 0][axis])),
    );
    const reversed = samplePortraitNasalSection(
      { point: right.point, derivative: right.derivative.map((v) => -v) },
      { point: left.point, derivative: left.derivative.map((v) => -v) },
      2,
      1 - t,
    );
    TestValidator.predicate(
      "reversed curve retains value and opposite slope",
      reversed.point.every((v, axis) => nclose(v, value.point[axis])) &&
        reversed.derivative.every((v, axis) =>
          nclose(v, -value.derivative[axis]),
        ),
    );
    const shift = [3, -7, 11];
    const translated = samplePortraitNasalSection(
      { ...left, point: left.point.map((v, axis) => v + shift[axis]) },
      { ...right, point: right.point.map((v, axis) => v + shift[axis]) },
      2,
      t,
    );
    TestValidator.predicate(
      "translated frame retains its curve",
      translated.point.every((v, axis) =>
        nclose(v, value.point[axis] + shift[axis]),
      ),
    );
  }
  const delta = [1, -2, 3],
    slope = [0.2, -0.3, 0.4],
    step = 1e-5;
  TestValidator.equals(
    "both surfaces share the exact seam position",
    portraitNasalJetCorrection(delta, slope, 4, 0),
    delta,
  );
  for (const direction of [-1, 1]) {
    const near = portraitNasalJetCorrection(delta, slope, 4, direction * step);
    TestValidator.predicate(
      "both physical directions approach one derivative",
      near.every((v, axis) =>
        nclose((v - delta[axis]) / (direction * step), slope[axis], 1e-5),
      ),
    );
    TestValidator.equals(
      "far correction is exactly zero",
      portraitNasalJetCorrection(delta, slope, 4, direction * 4),
      [0, 0, 0],
    );
    TestValidator.equals(
      "outside correction remains zero",
      portraitNasalJetCorrection(delta, slope, 4, direction * 5),
      [0, 0, 0],
    );
    const far = portraitNasalJetCorrection(
      delta,
      slope,
      4,
      direction * (4 - step),
    );
    TestValidator.predicate(
      "far derivative approaches zero",
      far.every((v) => Math.abs(v / step) < 1e-5),
    );
  }
  for (let i = 0; i <= 32; i++) {
    const value = samplePortraitNasalSection(
      { point: [0, 0, 0], derivative: [3, 0, 0] },
      { point: [0, 0, 0], derivative: [-3, 0, 0] },
      1,
      i / 32,
    );
    TestValidator.predicate(
      "rounded shoulder stays in its Bernstein hull",
      value.point[0] >= 0 && value.point[0] <= 1,
    );
  }
  const endpoint = samplePortraitNasalSection(left, right, 2, 0);
  endpoint.point[0] = 99;
  TestValidator.equals(
    "endpoint arrays are independently owned",
    left.point,
    [0, 0, 0],
  );
  for (const span of [0, -1, NaN, Infinity])
    TestValidator.predicate(
      "invalid span refuses",
      throwsError(
        () => samplePortraitNasalSection(left, right, span, 0.5),
        "positive span",
      ),
    );
  for (const t of [-0.1, 1.1, NaN])
    TestValidator.predicate(
      "invalid parameter refuses",
      throwsError(
        () => samplePortraitNasalSection(left, right, 2, t),
        "unit parameter",
      ),
    );
  for (const point of [
    [0, 0],
    [0, 0, Infinity],
  ])
    TestValidator.predicate(
      "invalid jet refuses",
      throwsError(
        () => samplePortraitNasalSection({ ...left, point }, right, 2, 0.5),
        "finite XYZ",
      ),
    );
  TestValidator.predicate(
    "overflowed tangent control refuses",
    throwsError(
      () =>
        samplePortraitNasalSection(
          { point: [1e308, 0, 0], derivative: [1e308, 0, 0] },
          right,
          6,
          0.5,
        ),
      "tangent controls",
    ),
  );
  const tiny = samplePortraitNasalSection(
    { point: [0, 0, 0], derivative: [1e308, 0, 0] },
    { point: [0, 0, 0], derivative: [1e308, 0, 0] },
    Number.MIN_VALUE,
    0.5,
  );
  TestValidator.predicate(
    "a tiny physical interval retains its finite scaled tangent",
    nclose(tiny.derivative[0] / 1e308, -0.5),
  );
  const wide = samplePortraitNasalSection(
    { point: [0, 0, 0], derivative: [4, 0, 0] },
    { point: [0, 0, 0], derivative: [0, 0, 0] },
    1e308,
    0.5,
  );
  TestValidator.predicate(
    "scaling before an overflowing product retains its finite control",
    nclose(wide.point[0] / 1e308, 0.5) && nclose(wide.derivative[0], -1),
  );
  TestValidator.predicate(
    "overflowed physical slope refuses",
    throwsError(
      () =>
        samplePortraitNasalSection(
          { point: [-1, 0, 0], derivative: [0, 0, 0] },
          { point: [1, 0, 0], derivative: [0, 0, 0] },
          Number.MIN_VALUE,
          0.5,
        ),
      "derivative",
    ),
  );
  TestValidator.predicate(
    "nonfinite signed distance refuses",
    throwsError(
      () => portraitNasalJetCorrection(delta, slope, 4, NaN),
      "distance",
    ),
  );
};
