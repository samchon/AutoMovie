import { IAutoMovieFaceTemplate, morphFace } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

/**
 * A morph target whose delta array disagrees with the template's vertex count
 * is a corrupt asset; adding what aligns and ignoring the rest would deform the
 * face unpredictably, so morphFace throws.
 *
 * Scenario: a 3-component template with a 6-component `eyeSizeR` delta throws.
 */
export const test_face_morph_length_mismatch = (): void => {
  const template: IAutoMovieFaceTemplate = {
    positions: [0, 0, 0],
    targets: { eyeSizeR: [1, 0, 0, 0, 0, 0], eyeSizeL: [1, 0, 0] },
  };
  TestValidator.predicate(
    "mismatched delta length throws",
    throwsError(
      () =>
        morphFace({
          template,
          face: makeFace({ eyes: { left: { size: 1 } } }),
        }),
      ['morph target "eyeSizeR"', "6 components"],
    ),
  );
};
