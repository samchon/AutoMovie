import { buildPortraitOralLining } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitOralLiningFixture } from "../internal/portraitOralLiningFixture";
import { nclose } from "../internal/predicates";

/**
 * Internal room has independent transverse and vertical dimensions behind an
 * unchanged lip aperture, with an explicit smooth vestibular transition.
 *
 * Scenarios:
 * 1. A square rim, 10 mm nominal depth and 9 mm transition give half expansion
 *    at 4.5 mm, full expansion at 9 mm, and the original rim and posterior pole.
 * 2. The posterior cosine taper scales both original section and expansion.
 * 3. Omission and two zero expansions are exact; each independent axis leaves
 *    the other coordinates unchanged. Repeat output and input ownership hold.
 */
export const test_subject_oral_chamber = (): void => {
  const surface = portraitOralLiningFixture(),
    saved = structuredClone(surface);
  const chamber = {
    horizontalExpansion: 5,
    verticalExpansion: 10,
    transitionDepth: 9,
  };
  const baseline = buildPortraitOralLining(surface, 0, 10, 0.75);
  const mesh = buildPortraitOralLining(surface, 0, 10, 0.75, chamber);
  TestValidator.equals(
    "rim retained exactly",
    mesh.positions.slice(0, 12),
    baseline.positions.slice(0, 12),
  );
  TestValidator.equals(
    "posterior pole retained",
    mesh.positions.slice(-3),
    baseline.positions.slice(-3),
  );
  TestValidator.equals(
    "half vestibular expansion",
    mesh.positions.slice(6 * 12, 6 * 12 + 3),
    [-3.5, 6, -4.5],
  );
  TestValidator.equals(
    "full vestibular expansion",
    mesh.positions.slice(12 * 12, 12 * 12 + 3),
    [-6, 11, -9],
  );
  TestValidator.predicate(
    "posterior taper includes expansion",
    nclose(mesh.positions[21 * 12], -6 * Math.SQRT1_2),
  );
  TestValidator.equals(
    "same triangle connectivity",
    mesh.indices,
    baseline.indices,
  );
  TestValidator.equals(
    "zero expansion exact",
    buildPortraitOralLining(surface, 0, 10, 0.75, {
      ...chamber,
      horizontalExpansion: 0,
      verticalExpansion: 0,
    }),
    baseline,
  );
  for (const axis of [0, 1]) {
    const shape = {
      ...chamber,
      horizontalExpansion: axis === 0 ? 5 : 0,
      verticalExpansion: axis === 1 ? 10 : 0,
    };
    const isolated = buildPortraitOralLining(surface, 0, 10, 0.75, shape);
    TestValidator.equals(
      "other axes exact",
      isolated.positions.filter((_v, i) => i % 3 !== axis),
      baseline.positions.filter((_v, i) => i % 3 !== axis),
    );
  }
  TestValidator.equals(
    "repeat exact",
    buildPortraitOralLining(surface, 0, 10, 0.75, chamber),
    mesh,
  );
  TestValidator.equals("source untouched", surface, saved);
  TestValidator.equals("profile untouched", chamber, {
    horizontalExpansion: 5,
    verticalExpansion: 10,
    transitionDepth: 9,
  });
  TestValidator.predicate(
    "all normals finite unit directions",
    mesh.normals!.every(
      (_v, i, a) =>
        i % 3 !== 0 || nclose(Math.hypot(a[i], a[i + 1], a[i + 2]), 1),
    ),
  );
};
