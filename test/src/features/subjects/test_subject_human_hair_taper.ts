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
 * A taper control follows the resolved hair region through inheritance and
 * complete replacement, and remains a portable document value.
 *
 * Scenarios:
 * 1. Missing hair has no taper; legacy basis and detail-only hair inherit zero.
 * 2. An explicit basis fraction survives resolution. A detailed fraction saves
 *    and reopens, and clearing it restores the basis without mutating callers.
 * 3. Invalid numbers, a side override and explicit null refuse admission.
 */
export const test_subject_human_hair_taper = (): void => {
  const face = humanFaceFixture(),
    id = "hair.taperStart";
  TestValidator.equals("no hair", humanFaceDetailValue(face, id), undefined);
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
  face.basis.recipe.hair = hair;
  TestValidator.equals("legacy default", humanFaceDetailValue(face, id), 0);
  const detailOnly = structuredClone(face);
  delete detailOnly.basis.recipe.hair;
  detailOnly.detail = { hair };
  TestValidator.equals(
    "replacement default",
    humanFaceDetailValue(detailOnly, id),
    0,
  );
  hair.taperStart = 0.25;
  const before = structuredClone(face),
    edited = setHumanFaceDetail(face, id, 0.75);
  TestValidator.equals("basis retained", humanFaceDetailValue(face, id), 0.25);
  TestValidator.equals(
    "edited fraction",
    humanFaceDetailValue(edited, id),
    0.75,
  );
  TestValidator.equals(
    "portable value",
    parseHumanFaceDocument(serializeHumanFaceDocument(edited)),
    edited,
  );
  TestValidator.equals(
    "clear restores basis",
    humanFaceDetailValue(setHumanFaceDetail(edited, id, undefined), id),
    0.25,
  );
  TestValidator.equals("caller unchanged", face, before);
  for (const value of [-0.001, 0.951, NaN])
    TestValidator.predicate(
      "out of envelope",
      throwsError(() => setHumanFaceDetail(face, id, value)),
    );
  TestValidator.predicate(
    "not paired",
    throwsError(() => setHumanFaceDetail(face, id, 0.5, "left")),
  );
  const malformed = structuredClone(face);
  malformed.basis.recipe.hair!.taperStart = null as unknown as number;
  TestValidator.equals(
    "null not repaired",
    resolveHumanFaceDocument(malformed).recipe.hair!.taperStart,
    null,
  );
  TestValidator.predicate(
    "null refused",
    throwsError(() => serializeHumanFaceDocument(malformed)),
  );
};
