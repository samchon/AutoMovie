import { TestValidator } from "@nestia/e2e";

import { fitPortraitPatchBoundary } from "../../subjects/portraitPatchAttachment";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Source-surface attachment preserves image-plane placement on a unit view ray.
 *
 * Scenarios:
 * 1. A host point at z=0 reaches a hand-authored z=2 plane. An oblique [1,0,1]
 *    ray reaches x+2,z=2, retaining x-z; ray magnitude changes nothing.
 * 2. Empty boundaries, zero reach and immutable inputs retain their meaning.
 *    Invalid points/distances/rays, a missed plane and an unbracketed root refuse.
 */
export const test_subject_patch_attachment = (): void => {
  const source = {
    positions: [
      [-10, -10, 2],
      [10, -10, 2],
      [10, 10, 2],
      [-10, 10, 2],
    ],
    indices: [0, 1, 2, 0, 2, 3],
    groups: [0, 0],
  };
  const host = { positions: [[1, 2, 0]], indices: [], viewRay: [0, 0, 1] };
  const shape = { reach: 0, travel: 4 };
  const before = structuredClone({ source, host, shape });
  const result = fitPortraitPatchBoundary(host, [0], source, shape);
  TestValidator.predicate("plane depth", nclose(result[0].target[2], 2));
  TestValidator.equals("zero reach", result[0].reach, 0);
  const oblique = fitPortraitPatchBoundary(
    { ...host, viewRay: [1, 0, 1] },
    [0],
    source,
    { ...shape, reach: 12 },
  );
  TestValidator.predicate(
    "oblique target",
    oblique[0].target.every((v, i) => nclose(v, [3, 2, 2][i])),
  );
  TestValidator.predicate(
    "image coordinate preserved",
    nclose(oblique[0].target[0] - oblique[0].target[2], 1),
  );
  TestValidator.equals(
    "unit ray scale",
    fitPortraitPatchBoundary({ ...host, viewRay: [2, 0, 2] }, [0], source, {
      ...shape,
      reach: 12,
    }),
    oblique,
  );
  TestValidator.equals(
    "empty boundary",
    fitPortraitPatchBoundary(host, [], source, shape),
    [],
  );
  TestValidator.equals("inputs unchanged", { source, host, shape }, before);
  for (const invalid of [
    { reach: -1 },
    { reach: NaN },
    { travel: 0 },
    { travel: Infinity },
    { travel: -1 },
  ])
    TestValidator.predicate(
      "bad distances",
      throwsError(() =>
        fitPortraitPatchBoundary(host, [0], source, { ...shape, ...invalid }),
      ),
    );
  for (const viewRay of [[], [0, 1], [0, 0, NaN], [0, 0, 0]])
    TestValidator.predicate(
      "bad ray",
      throwsError(() =>
        fitPortraitPatchBoundary({ ...host, viewRay }, [0], source, shape),
      ),
    );
  for (const boundary of [[-1], [0.5], [2]])
    TestValidator.predicate(
      "bad identity",
      throwsError(() =>
        fitPortraitPatchBoundary(host, boundary, source, shape),
      ),
    );
  for (const point of [
    [0, 0],
    [NaN, 0, 0],
  ])
    TestValidator.predicate(
      "bad point",
      throwsError(() =>
        fitPortraitPatchBoundary(
          { ...host, positions: [point] },
          [0],
          source,
          shape,
        ),
      ),
    );
  TestValidator.predicate(
    "missed surface",
    throwsError(() =>
      fitPortraitPatchBoundary(
        { ...host, positions: [[20, 0, 0]] },
        [0],
        source,
        shape,
      ),
    ),
  );
  TestValidator.predicate(
    "unbracketed surface",
    throwsError(() =>
      fitPortraitPatchBoundary(host, [0], source, { ...shape, travel: 1 }),
    ),
  );
};
