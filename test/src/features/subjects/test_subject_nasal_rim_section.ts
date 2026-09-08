import { TestValidator } from "@nestia/e2e";

import {
  appendPortraitNasalRimSection,
  createPortraitNasalRimSection,
} from "../../subjects/generated-korean-girl-01/nasalRimSection";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A nasal skin band gives a fitted opening physical tissue width and crest.
 *
 * Scenarios:
 * 1. A radius-two planar square has outer radius three, half-width crest
 *    radius 2.5 and z=0.3. The aperture stays fixed under translation/copying.
 * 2. Attachment uses original outer IDs, creates two rings and returns the
 *    actual inner IDs for lining. Invalid or unrepresentable sections refuse.
 */
export const test_subject_nasal_rim_section = (): void => {
  const points = [
    [2, 0, 0],
    [0, 2, 0],
    [-2, 0, 0],
    [0, -2, 0],
  ];
  const shape = { width: 1, crest: 0.3 };
  const section = createPortraitNasalRimSection(points, shape);
  TestValidator.equals("outer width", section.outer[0], [3, 0, 0]);
  TestValidator.equals("crest section", section.crest[0], [2.5, 0, 0.3]);
  TestValidator.equals("aperture retained", section.rim, points);
  const moved = createPortraitNasalRimSection(
    points.map((p) => p.map((v, i) => v + [10, 20, 30][i])),
    shape,
  );
  TestValidator.predicate(
    "translated section",
    moved.crest[0].every((v, i) =>
      nclose(v, section.crest[0][i] + [10, 20, 30][i]),
    ),
  );
  TestValidator.equals(
    "zero crest",
    createPortraitNasalRimSection(points, { ...shape, crest: 0 }).crest[0],
    [2.5, 0, 0],
  );
  TestValidator.equals(
    "signed crest",
    createPortraitNasalRimSection(points, { ...shape, crest: -0.3 }).crest[0],
    [2.5, 0, -0.3],
  );
  const cage = {
    positions: section.outer.map((p) => [...p]),
    indices: [] as number[],
    groups: [] as number[],
  };
  const loop = appendPortraitNasalRimSection(cage, [0, 1, 2, 3], section, 7);
  TestValidator.equals("inner identities", loop, [8, 9, 10, 11]);
  TestValidator.equals("two connected annuli", cage.indices.length, 48);
  TestValidator.predicate(
    "skin labels",
    cage.groups.length === 16 && cage.groups.every((g) => g === 7),
  );
  TestValidator.equals(
    "resident outer edge",
    cage.indices.slice(0, 3),
    [0, 1, 4],
  );
  section.rim[0][0] = 99;
  points[0][0] = 99;
  TestValidator.equals("owned inner points", cage.positions[8], [2, 0, 0]);
  const base = [
    [2, 0, 0],
    [0, 2, 0],
    [-2, 0, 0],
    [0, -2, 0],
  ];
  for (const invalid of [
    { width: 0 },
    { width: -1 },
    { width: NaN },
    { width: Infinity },
    { crest: NaN },
  ])
    TestValidator.predicate(
      "invalid shape",
      throwsError(() =>
        createPortraitNasalRimSection(base, { ...shape, ...invalid }),
      ),
    );
  for (const invalid of [
    [],
    [
      [0, 0, 0],
      [1, 0, 0],
    ],
    [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
    ],
    [
      [NaN, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
    ],
    [
      [0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ],
  ])
    TestValidator.predicate(
      "invalid boundary",
      throwsError(() => createPortraitNasalRimSection(invalid, shape)),
    );
  TestValidator.predicate(
    "unrepresentable width",
    throwsError(() =>
      createPortraitNasalRimSection(base, { width: 1e-300, crest: 0 }),
    ),
  );
  TestValidator.predicate(
    "crest overflow",
    throwsError(() =>
      createPortraitNasalRimSection(
        base.map((p) => [p[0], p[1], Number.MAX_VALUE]),
        { width: 1, crest: Number.MAX_VALUE },
      ),
    ),
  );
  const valid = createPortraitNasalRimSection(base, shape);
  for (const outer of [
    [],
    [0, 1, 1, 3],
    [0, 1, 2, 99],
    [0, 1, 2, -1],
    [0, 1, 2, 0.5],
  ])
    TestValidator.predicate(
      "invalid attachment",
      throwsError(() => appendPortraitNasalRimSection(cage, outer, valid, 0)),
    );
  for (const group of [-1, 0.5, NaN])
    TestValidator.predicate(
      "invalid group",
      throwsError(() =>
        appendPortraitNasalRimSection(cage, [0, 1, 2, 3], valid, group),
      ),
    );
  for (const malformed of [
    { ...valid, rim: [] },
    { ...valid, crest: [] },
    { ...valid, rim: [[NaN, 0, 0], ...valid.rim.slice(1)] },
    { ...valid, crest: [[0, 0], ...valid.crest.slice(1)] },
  ])
    TestValidator.predicate(
      "malformed rings",
      throwsError(() =>
        appendPortraitNasalRimSection(cage, [0, 1, 2, 3], malformed, 0),
      ),
    );
};
