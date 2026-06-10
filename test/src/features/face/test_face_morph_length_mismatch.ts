import { IAutoFilmFaceTemplate, morphFace } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * A morph target whose delta array disagrees with the template's vertex count
 * is a corrupt asset; adding what aligns and ignoring the rest would deform the
 * face unpredictably, so morphFace throws.
 *
 * Scenario: a 3-component template with a 6-component `eyeSize` delta throws.
 */
export const test_face_morph_length_mismatch = (): void => {
  const template: IAutoFilmFaceTemplate = {
    positions: [0, 0, 0],
    targets: { eyeSize: [1, 0, 0, 0, 0, 0] },
  };
  TestValidator.error("mismatched delta length throws", () =>
    morphFace({
      template,
      face: makeFace([{ parameter: "eyeSize", weight: 1 }]),
    }),
  );
};
