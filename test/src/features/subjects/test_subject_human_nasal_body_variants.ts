import { resolveHumanFaceDocument } from "@automovie/human";
import { createPortraitNasalBodySurface } from "@automovie/human/components/nasalBodySurface";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Alternative nasal surfaces replace another alternative rather than merging
 * incompatible controls from different document layers.
 *
 * Scenarios:
 * 1. All nine ordered pairs of additive, loft and local targets resolve to the
 *    selected payload while keeping inherited joining distances and owned data.
 * 2. Same-loft partial edits, untagged additive edits and empty overrides inherit
 *    their remaining fields. Ambiguous incoming or inherited shapes stay invalid.
 */
export const test_subject_human_nasal_body_variants = (): void => {
  type Shape = Parameters<typeof createPortraitNasalBodySurface>[0];
  const additive: Shape = {
    stations: [0, 1].map((height) => ({
      height,
      centre: 0,
      shoulder: 0,
      ala: 0,
    })),
    centreWidth: 1,
    shoulderOffset: 2,
    shoulderWidth: 1,
    alarOffset: 3,
    alarWidth: 1,
    fullness: [0, 0],
    spread: [0, 0],
    creaseOffset: 1,
    creaseWidth: 1,
    crease: [0, 0],
  };
  const section = {
    transverse: [-3, -1, 1, 3],
    stations: [-3, -1, 1, 3].map((height) => ({
      height,
      depths: [0, 0, 0, 0],
    })),
    joinWidth: 1,
    influence: 1,
  };
  const variants: Shape[] = [additive, { section }, { lobules: [] }];
  const create = (shape: Shape) => {
    const document = humanFaceFixture("nasal-alternative");
    document.basis.recipe.nose.body = {
      shape: structuredClone(shape),
      joinWidth: 2,
      depthReach: 40,
    };
    return document;
  };
  for (const basis of variants)
    for (const selected of variants) {
      const document = create(basis);
      document.detail = { nose: { body: { shape: selected } } };
      const saved = structuredClone(document),
        actual = resolveHumanFaceDocument(document).recipe.nose.body!;
      TestValidator.equals("one chosen payload", actual.shape, selected);
      TestValidator.equals(
        "surrounding dimensions inherit",
        [actual.joinWidth, actual.depthReach],
        [2, 40],
      );
      TestValidator.equals("input ownership", document, saved);
    }
  const partial = create({ section });
  partial.detail = {
    nose: { body: { shape: { section: { influence: 0.3 } } } },
  };
  TestValidator.equals(
    "same loft retains its controls",
    resolveHumanFaceDocument(partial).recipe.nose.body!.shape,
    { section: { ...section, influence: 0.3 } },
  );
  const plain = create(additive);
  plain.detail = { nose: { body: { shape: { fullness: [0.2, 0.3] } } } };
  TestValidator.equals(
    "untagged additive detail keeps its stations",
    resolveHumanFaceDocument(plain).recipe.nose.body!.shape,
    { ...additive, fullness: [0.2, 0.3] },
  );
  plain.detail = { nose: { body: { shape: {} } } };
  TestValidator.equals(
    "empty override is not a mode switch",
    resolveHumanFaceDocument(plain).recipe.nose.body!.shape,
    additive,
  );
  for (let i = 0; i < variants.length; i++)
    for (let j = i + 1; j < variants.length; j++) {
      const mixed = { ...variants[i], ...variants[j] } as Shape;
      TestValidator.predicate(
        "one object cannot select two alternatives",
        throwsError(
          () => createPortraitNasalBodySurface(mixed, 0, 1, [0, 0, 1], 2, 40),
          "one final nasal target",
        ),
      );
      for (const inherited of [false, true]) {
        const document = create(inherited ? mixed : variants[i]);
        document.detail = {
          nose: { body: { shape: inherited ? variants[j] : mixed } },
        };
        const shape =
          resolveHumanFaceDocument(document).recipe.nose.body!.shape;
        TestValidator.predicate(
          "ambiguous layers are not silently repaired",
          throwsError(
            () => createPortraitNasalBodySurface(shape, 0, 1, [0, 0, 1], 2, 40),
            "one final nasal target",
          ),
        );
      }
    }
};
