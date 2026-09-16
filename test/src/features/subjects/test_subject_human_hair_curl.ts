import {
  type IPortraitHairShape,
  humanFaceDetailValue,
  parseHumanFaceDocument,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Curl controls belong to a complete optional hair profile in portable JSON.
 * Scenarios:
 * 1. Absent hair and legacy hair have no implicit curl profile.
 * 2. Each detailed scalar overrides its inherited profile, clears back to its
 *    basis value and survives serialize/parse without changing caller data.
 * 3. Side overrides and out-of-envelope values refuse; partial profiles cannot
 *    be saved as complete source recipes.
 */
export const test_subject_human_hair_curl = (): void => {
  const face = humanFaceFixture();
  const shape: IPortraitHairShape = {
    material: "hair",
    cards: [],
    segments: 2,
    widthScale: 1,
    tipWidth: 0.5,
    seed: 1,
    fibres: 1,
    coverage: 1,
  };
  TestValidator.equals(
    "no hair",
    humanFaceDetailValue(face, "hair.fibreCurl.amplitude"),
    undefined,
  );
  face.basis.recipe.hair = shape;
  TestValidator.equals(
    "legacy has no curl",
    humanFaceDetailValue(face, "hair.fibreCurl.amplitude"),
    undefined,
  );
  shape.fibreCurl = { amplitude: 0.2, cycles: 3, aspectRatio: 0.5 };
  const before = structuredClone(face);
  for (const [key, value] of [
    ["amplitude", 0.3],
    ["cycles", 4.8],
    ["aspectRatio", 1],
  ] as const) {
    const id = `hair.fibreCurl.${key}`,
      edited = setHumanFaceDetail(face, id, value);
    TestValidator.equals(
      "detailed value",
      humanFaceDetailValue(edited, id),
      value,
    );
    TestValidator.equals(
      "portable profile",
      parseHumanFaceDocument(serializeHumanFaceDocument(edited)),
      edited,
    );
    TestValidator.equals(
      "clear restores basis",
      humanFaceDetailValue(setHumanFaceDetail(edited, id, undefined), id),
      shape.fibreCurl[key],
    );
    TestValidator.predicate(
      "not paired",
      throwsError(() => setHumanFaceDetail(face, id, value, "left")),
    );
    TestValidator.predicate(
      "invalid scalar",
      throwsError(() => setHumanFaceDetail(face, id, -1)),
    );
  }
  TestValidator.equals("input untouched", face, before);
  delete (shape.fibreCurl as Partial<typeof shape.fibreCurl>).cycles;
  TestValidator.predicate(
    "partial basis refuses JSON",
    throwsError(() => serializeHumanFaceDocument(face)),
  );
};
