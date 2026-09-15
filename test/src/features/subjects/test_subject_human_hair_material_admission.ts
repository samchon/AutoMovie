import {
  buildHumanFace,
  createPortraitHairMaterial,
  createPortraitMaterials,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import { portraitHairShadeFixture } from "../internal/portraitHairShadeFixture";
import { throwsError } from "../internal/predicates";

/**
 * Hair finish failures are admitted before unrelated face assembly.
 * Scenarios:
 * 1. A populated groom naming a missing resident finish refuses.
 * 2. A resident finish with the actual derived identity refuses collision;
 *    the separate full-builder scenario proves the noncolliding counterpart.
 */
export const test_subject_human_hair_material_admission = (): void => {
  const doc = coarseHumanFaceFixture("hair-admission");
  doc.appearance = createPortraitMaterials();
  const shape = { ...portraitHairShadeFixture().shape, material: "hair" };
  doc.detail = { hair: shape };
  const missing = structuredClone(doc);
  missing.detail!.hair!.material = "absent";
  TestValidator.predicate(
    "missing finish",
    throwsError(() => buildHumanFace(missing, 0), "named resident"),
  );
  doc.appearance = [
    ...doc.appearance,
    createPortraitHairMaterial(
      doc.appearance.find((m) => m.id === "hair")!,
      shape,
    ),
  ];
  TestValidator.predicate(
    "derived identity collision",
    throwsError(() => buildHumanFace(doc, 0), "collides"),
  );
};
