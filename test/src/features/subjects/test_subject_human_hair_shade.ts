import {
  humanFaceDetailValue,
  parseHumanFaceDocument,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";
import { throwsError } from "../internal/predicates";

/**
 * Portable shade controls inherit defaults without rewriting the source basis.
 * Scenarios:
 * 1. No groom leaves the scalar absent; a legacy groom resolves to one.
 * 2. Zero, half and one survive JSON and clear to the unchanged inherited value.
 * 3. Out-of-envelope and paired edits refuse; a selected basis value is retained.
 */
export const test_subject_human_hair_shade = (): void => {
  const face = humanFaceFixture(),
    id = "hair.fibreShadeStrength";
  TestValidator.equals("no hair", humanFaceDetailValue(face, id), undefined);
  face.basis.recipe.hair = { ...portraitHairShadeFixture().shape, cards: [] };
  TestValidator.equals(
    "legacy resolves one",
    humanFaceDetailValue(face, id),
    1,
  );
  const before = structuredClone(face);
  for (const value of [0, 0.5, 1]) {
    const edited = setHumanFaceDetail(face, id, value);
    TestValidator.equals(
      "edited strength",
      humanFaceDetailValue(edited, id),
      value,
    );
    TestValidator.equals(
      "JSON strength exact",
      parseHumanFaceDocument(serializeHumanFaceDocument(edited)),
      edited,
    );
    TestValidator.equals(
      "clear inherits default",
      humanFaceDetailValue(setHumanFaceDetail(edited, id, undefined), id),
      1,
    );
  }
  for (const value of [-0.01, 1.01, NaN])
    TestValidator.predicate(
      "invalid edit",
      throwsError(() => setHumanFaceDetail(face, id, value)),
    );
  TestValidator.predicate(
    "not sided",
    throwsError(() => setHumanFaceDetail(face, id, 0, "left")),
  );
  TestValidator.equals("source not mutated", face, before);
  face.basis.recipe.hair.fibreShadeStrength = 0.25;
  TestValidator.equals(
    "authored basis retained",
    humanFaceDetailValue(face, id),
    0.25,
  );
};
