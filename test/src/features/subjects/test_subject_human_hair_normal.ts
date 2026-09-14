import {
  type IPortraitHairShape,
  humanFaceDetailValue,
  parseHumanFaceDocument,
  resolveHumanFaceDocument,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Fibre relief belongs to the resolved groom, including a groom first supplied
 * through detailed replacement instead of the original basis.
 * Scenarios:
 * 1. No groom has no value; basis and detail-only grooms default to zero.
 * 2. Positive strength saves/reopens, clear restores inheritance, and neither
 *    resolution nor editing mutates the caller's guide or appearance data.
 * 3. Out-of-envelope, side-owned and null inputs refuse rather than clamp.
 */
export const test_subject_human_hair_normal = (): void => {
  const input = humanFaceFixture();
  const id = "hair.fibreNormalScale";
  TestValidator.equals(
    "absent groom",
    humanFaceDetailValue(input, id),
    undefined,
  );
  const hair: IPortraitHairShape = {
    material: "hair",
    cards: [],
    segments: 2,
    widthScale: 1,
    tipWidth: 0.5,
    seed: 0,
    fibres: 1,
    coverage: 1,
  };
  input.basis.recipe.hair = hair;
  TestValidator.equals("basis default", humanFaceDetailValue(input, id), 0);
  const detailed = {
    ...input,
    basis: {
      ...input.basis,
      recipe: { ...input.basis.recipe, hair: undefined },
    },
    detail: { hair },
  };
  TestValidator.equals(
    "detail-only default",
    humanFaceDetailValue(detailed, id),
    0,
  );
  const before = structuredClone(input);
  const edited = setHumanFaceDetail(input, id, 0.4);
  TestValidator.equals(
    "complete replay",
    parseHumanFaceDocument(serializeHumanFaceDocument(edited)),
    edited,
  );
  TestValidator.equals("applied detail", humanFaceDetailValue(edited, id), 0.4);
  TestValidator.equals(
    "clear returns to zero",
    humanFaceDetailValue(setHumanFaceDetail(edited, id, undefined), id),
    0,
  );
  input.basis.recipe.hair.fibreNormalScale = 0.8;
  TestValidator.equals(
    "authored basis retained",
    humanFaceDetailValue(input, id),
    0.8,
  );
  input.basis.recipe.hair = before.basis.recipe.hair;
  TestValidator.equals("caller otherwise unchanged", input, before);
  for (const value of [-0.01, 1.01, NaN])
    TestValidator.predicate(
      "invalid scalar",
      throwsError(() => setHumanFaceDetail(input, id, value)),
    );
  TestValidator.predicate(
    "groom is not paired",
    throwsError(() => setHumanFaceDetail(input, id, 0.4, "left")),
  );
  const malformed = structuredClone(input);
  malformed.basis.recipe.hair!.fibreNormalScale = null as unknown as number;
  TestValidator.equals(
    "null is not silently repaired",
    resolveHumanFaceDocument(malformed).recipe.hair!.fibreNormalScale,
    null,
  );
  TestValidator.predicate(
    "null refuses save",
    throwsError(() => serializeHumanFaceDocument(malformed)),
  );
};
