import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitNasalLobule,
  createPortraitNasalLobules,
} from "../../subjects/generated-korean-girl-01/nasalLobule";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Ellipsoidal anterior sections prescribe depth with an identity outer join.
 * Hand circle geometry supplies the oracle independently of the evaluator.
 *
 * Scenarios:
 * 1. A radius-five section has height four at x=3. Its apex, exterior and
 *    translated/owned inputs pin local geometry and neutral/default behavior.
 *    Independent X/Y tangent slopes add their hand-computed plane heights.
 * 2. Two coincident sections average their depths, regardless of order; the
 *    annular midpoint has half influence. Boundary slope converges to zero.
 * 3. Invalid dimensions, datums, samples and overflowing frames refuse, while
 *    empty, zero-core and the 32-section bound remain valid.
 */
export const test_subject_nasal_lobules = (): void => {
  const shape: IPortraitNasalLobule = {
    anchor: 0,
    offset: [0, 0, 5],
    radii: [5, 5, 5],
    core: 0.8,
  };
  const bind = createPortraitNasalLobules([shape]);
  const datums = [[0, 0, 0]];
  const sample = bind(datums);
  TestValidator.predicate(
    "three four five section",
    nclose(sample([3, 0, 0]), 4),
  );
  TestValidator.equals("apex", sample([0, 0, 0]), 5);
  TestValidator.equals("exact boundary", sample([5, 0, 17]), 0);
  TestValidator.equals("outside", sample([6, 0, 17]), 0);
  TestValidator.equals(
    "omitted identity",
    createPortraitNasalLobules()([])([0, 0, 17]),
    0,
  );
  TestValidator.equals(
    "empty identity",
    createPortraitNasalLobules([])([])([0, 0, 17]),
    0,
  );
  const translated = bind([[10, 20, 30]]);
  TestValidator.predicate("translation", nclose(translated([13, 20, 30]), 4));
  (shape.offset as number[])[2] = 50;
  datums[0][2] = 50;
  TestValidator.equals("owned shape and datum", sample([0, 0, 0]), 5);
  const a = { ...shape, offset: [0, 0, 5] },
    b = { ...shape, offset: [0, 0, 9] };
  const slope = [0.5, -0.25];
  const inclined = createPortraitNasalLobules([{ ...a, slope }])([[0, 0, 0]]);
  TestValidator.predicate(
    "inclined x section",
    nclose(inclined([3, 0, 0]), 5.5),
  );
  TestValidator.predicate(
    "inclined y section",
    nclose(inclined([0, 3, 0]), 3.25),
  );
  slope[0] = 50;
  TestValidator.predicate("owned tangent", nclose(inclined([3, 0, 0]), 5.5));
  TestValidator.equals(
    "zero tangent identity",
    createPortraitNasalLobules([{ ...a, slope: [0, 0] }])([[0, 0, 0]])([
      3, 0, 0,
    ]),
    sample([3, 0, 0]),
  );
  TestValidator.equals(
    "overlap mean",
    createPortraitNasalLobules([a, b])([[0, 0, 0]])([0, 0, 0]),
    7,
  );
  TestValidator.equals(
    "reverse overlap",
    createPortraitNasalLobules([b, a])([[0, 0, 0]])([0, 0, 0]),
    7,
  );
  const fade = createPortraitNasalLobules([{ ...a, core: 0 }])([[0, 0, 0]]);
  TestValidator.predicate(
    "half annulus",
    nclose(fade([2.5, 0, 0]), Math.sqrt(18.75) / 2),
  );
  const near = 1e-5;
  TestValidator.predicate(
    "joined outer slope",
    Math.abs(fade([5 - near, 0, 1]) / near) < 1e-4,
  );
  TestValidator.predicate(
    "max sections",
    nclose(
      createPortraitNasalLobules(Array.from({ length: 32 }, () => a))([
        [0, 0, 0],
      ])([0, 0, 0]),
      5,
    ),
  );
  for (const wrong of [
    { anchor: -1 },
    { anchor: 0.5 },
    { offset: [0, 0] },
    { offset: [0, NaN, 0] },
    { radii: [1, 1] },
    { radii: [1, 0, 1] },
    { radii: [1, -1, 1] },
    { radii: [1, Infinity, 1] },
    { core: -0.1 },
    { core: 1 },
    { core: NaN },
    { slope: [] },
    { slope: [0, NaN] },
  ])
    TestValidator.predicate(
      "invalid section",
      throwsError(() => createPortraitNasalLobules([{ ...a, ...wrong }])),
    );
  TestValidator.predicate(
    "population bound",
    throwsError(() =>
      createPortraitNasalLobules(Array.from({ length: 33 }, () => a)),
    ),
  );
  for (const wrong of [[], [[0, 0]], [[0, 0, NaN]]])
    TestValidator.predicate(
      "invalid datum",
      throwsError(() => bind(wrong)),
    );
  for (const wrong of [
    [0, 0],
    [0, Infinity, 0],
  ])
    TestValidator.predicate(
      "invalid sample",
      throwsError(() => sample(wrong)),
    );
  const extreme = { ...a, offset: [0, 0, Number.MAX_VALUE] };
  TestValidator.predicate(
    "apex overflow",
    throwsError(() =>
      createPortraitNasalLobules([extreme])([[0, 0, Number.MAX_VALUE]]),
    ),
  );
  TestValidator.predicate(
    "sample overflow",
    throwsError(() =>
      createPortraitNasalLobules([extreme])([[0, 0, 0]])([
        0,
        0,
        -Number.MAX_VALUE,
      ]),
    ),
  );
  TestValidator.equals(
    "distant finite exterior",
    sample([Number.MAX_VALUE, 0, 0]),
    0,
  );
};
