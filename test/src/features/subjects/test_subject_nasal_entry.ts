import { TestValidator } from "@nestia/e2e";

import {
  portraitNasalRimJets,
  samplePortraitNasalEntry,
} from "../../subjects/generated-korean-girl-01/nasalAperture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * One aperture group supplies a shared rim jet and a complete two-interval
 * vestibular meridian, with a planar floor approach and no body-depth refit.
 *
 * Scenarios:
 * 1. A unit square rim gives known cyclic tangents and outward co-normals even
 *    when the supplied normal sign changes; singular/ambiguous data refuse.
 * 2. The entry meets its exact rim, contracted section and floor. One middle
 *    derivative belongs to both intervals, and translating the group preserves
 *    the meridian. A nonplanar rim still reaches the declared floor tangent plane.
 * 3. Invalid samples, directions and collapsed/nonrepresentable intervals refuse.
 */
export const test_subject_nasal_entry = (): void => {
  const points = [
    [1, 0, 0],
    [0, 1, 0],
    [-1, 0, 0],
    [0, -1, 0],
  ];
  const exterior = points.map((p) => p.map((v) => 2 * v));
  const jets = portraitNasalRimJets(
    points,
    points.map(() => [0, 0, 1]),
    exterior,
  );
  TestValidator.equals(
    "cyclic tangent has its physical direction",
    jets[0].tangent,
    [0, 1, 0],
  );
  TestValidator.equals(
    "exterior selects the outward co-normal",
    jets[0].transverse,
    [1, 0, 0],
  );
  TestValidator.equals(
    "normal sign does not reverse the external side",
    portraitNasalRimJets(
      points,
      points.map(() => [0, 0, -1]),
      exterior,
    ),
    jets,
  );
  const frame = { origin: [0, 0, 0], inward: [0, 0, -1] };
  const first = Math.sqrt(4.25),
    last = 0.5,
    split = first / (first + last);
  const start = samplePortraitNasalEntry(jets[0], frame, 2, 0.5, 0);
  TestValidator.equals(
    "entry position belongs to the shared rim",
    start.point,
    points[0],
  );
  TestValidator.equals(
    "entry derivative uses the opposite physical direction",
    start.derivative,
    [-1, 0, 0],
  );
  const middle = samplePortraitNasalEntry(jets[0], frame, 2, 0.5, split);
  TestValidator.equals(
    "contracted section has the authored position",
    middle.point,
    [0.5, 0, -2],
  );
  for (const t of [split - 1e-7, split + 1e-7]) {
    const near = samplePortraitNasalEntry(jets[0], frame, 2, 0.5, t);
    TestValidator.predicate(
      "both intervals share the middle physical derivative",
      near.derivative.every((v, axis) =>
        nclose(v, middle.derivative[axis], 2e-6),
      ),
    );
  }
  const end = samplePortraitNasalEntry(jets[0], frame, 2, 0.5, 1);
  TestValidator.equals(
    "all meridians share the declared floor",
    end.point,
    [0, 0, -2],
  );
  TestValidator.equals(
    "floor approach lies in its own plane",
    end.derivative,
    [-1, 0, 0],
  );
  const nonplanar = samplePortraitNasalEntry(
    { ...jets[0], point: [1, 0, 0.2] },
    frame,
    2,
    0.5,
    1,
  );
  TestValidator.equals(
    "rim residual does not tilt the floor tangent plane",
    nonplanar.derivative,
    [-1, 0, 0],
  );
  const shift = [3, -4, 5];
  const translated = samplePortraitNasalEntry(
    { ...jets[0], point: jets[0].point.map((v, i) => v + shift[i]) },
    { origin: shift, inward: [0, 0, -10] },
    2,
    0.5,
    0.4,
  );
  const original = samplePortraitNasalEntry(jets[0], frame, 2, 0.5, 0.4);
  TestValidator.predicate(
    "group translation and direction scale preserve the section",
    translated.point.every((v, i) => nclose(v, original.point[i] + shift[i])),
  );
  for (const bad of [
    points.slice(0, 2),
    [[0, 0], ...points.slice(1)],
    [[NaN, 0, 0], ...points.slice(1)],
  ])
    TestValidator.predicate(
      "malformed rim data refuse",
      throwsError(
        () =>
          portraitNasalRimJets(
            bad,
            points.map(() => [0, 0, 1]),
            exterior,
          ),
        "aligned finite",
      ),
    );
  TestValidator.predicate(
    "missing exterior row refuses",
    throwsError(
      () =>
        portraitNasalRimJets(
          points,
          points.map(() => [0, 0, 1]),
          exterior.slice(1),
        ),
      "aligned finite",
    ),
  );
  for (const normals of [
    points.map(() => [0, 0, 0]),
    points.map(() => [0, 1, 0]),
  ])
    TestValidator.predicate(
      "degenerate co-normal refuses",
      throwsError(
        () => portraitNasalRimJets(points, normals, exterior),
        "regular tangent",
      ),
    );
  TestValidator.predicate(
    "ambiguous exterior direction refuses",
    throwsError(
      () =>
        portraitNasalRimJets(
          points,
          points.map(() => [0, 0, 1]),
          points,
        ),
      "unambiguous exterior",
    ),
  );
  TestValidator.predicate(
    "zero cyclic tangent refuses",
    throwsError(
      () =>
        portraitNasalRimJets(
          [
            [1, 0, 0],
            [0, 1, 0],
            [1, 0, 0],
          ],
          new Array(3).fill([0, 0, 1]),
          new Array(3).fill([2, 0, 0]),
        ),
      "regular tangent",
    ),
  );
  TestValidator.predicate(
    "nonrepresentable rim differential refuses",
    throwsError(
      () =>
        portraitNasalRimJets(
          [
            [0, 0, 0],
            [Number.MAX_VALUE, 1, 0],
            [0, 2, 0],
            [-Number.MAX_VALUE, 1, 0],
          ],
          points.map(() => [0, 0, 1]),
          exterior,
        ),
      "regular tangent",
    ),
  );
  for (const args of [
    [0, 0.5, 0.5],
    [2, 0, 0.5],
    [2, 1, 0.5],
    [2, 0.5, -1],
    [2, 0.5, NaN],
  ])
    TestValidator.predicate(
      "invalid entry dimension or phase refuses",
      throwsError(
        () =>
          samplePortraitNasalEntry(jets[0], frame, args[0], args[1], args[2]),
        "positive depth",
      ),
    );
  TestValidator.predicate(
    "malformed group frame refuses",
    throwsError(
      () =>
        samplePortraitNasalEntry(
          jets[0],
          { ...frame, origin: [0, 0] },
          2,
          0.5,
          0.5,
        ),
      "finite jets",
    ),
  );
  TestValidator.predicate(
    "zero inward direction refuses",
    throwsError(
      () =>
        samplePortraitNasalEntry(
          jets[0],
          { ...frame, inward: [0, 0, 0] },
          2,
          0.5,
          0.5,
        ),
      "nonzero inward",
    ),
  );
  for (const point of [
    [0, 0, 0],
    [0, 0, -4],
  ])
    TestValidator.predicate(
      "collapsed entry sections refuse",
      throwsError(
        () =>
          samplePortraitNasalEntry({ ...jets[0], point }, frame, 2, 0.5, 0.5),
        "nonzero body",
      ),
    );
  TestValidator.predicate(
    "unrepresentable entry coordinates refuse",
    throwsError(
      () =>
        samplePortraitNasalEntry(
          jets[0],
          { origin: [0, 0, -Number.MAX_VALUE], inward: [0, 0, -1] },
          Number.MAX_VALUE,
          0.5,
          0.5,
        ),
      "finite nonzero",
    ),
  );
};
