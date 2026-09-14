import {
  buildHumanFace,
  humanFaceRegionValue,
  replaceHumanFaceRegion,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Empty surface-hair profiles remain an explicit removal, not a default groom.
 * Scenarios:
 * 1. Region replacement and scalar edits preserve an empty guide array. A real
 *    head build emits no hair part or derived finish and needs no base finish.
 * 2. Clearing the override restores absence; side-only hair edits refuse.
 */
export const test_subject_human_empty_hair = (): void => {
  const original = coarseHumanFaceFixture("empty-hair");
  const replaced = replaceHumanFaceRegion({
    document: original,
    basisId: original.basis.id,
    region: "hair",
    value: {
      material: "unused",
      cards: [],
      segments: 2,
      widthScale: 1,
      tipWidth: 0.5,
      seed: 0,
      fibres: 1,
      coverage: 1,
    },
  });
  const document = setHumanFaceDetail(replaced, "hair.coverage", 0.5);
  TestValidator.equals(
    "empty profile is explicit",
    humanFaceRegionValue(document, "hair")?.cards,
    [],
  );
  const model = buildHumanFace(document, 0);
  TestValidator.predicate(
    "no invented hair part",
    model.parts.every((p) => p.id !== "scalp-hair-cards"),
  );
  TestValidator.predicate(
    "no unused mask finish",
    model.materials.every((m) => !m.id.endsWith(":hair-cards")),
  );
  TestValidator.equals(
    "clearing restores absence",
    humanFaceRegionValue(
      replaceHumanFaceRegion({
        document,
        basisId: document.basis.id,
        region: "hair",
        value: undefined,
      }),
      "hair",
    ),
    undefined,
  );
  TestValidator.predicate(
    "hair has one owner",
    throwsError(() => humanFaceRegionValue(document, "hair", "left")),
  );
  TestValidator.predicate(
    "integral card sampling",
    throwsError(() => setHumanFaceDetail(document, "hair.segments", 2.5)),
  );
};
