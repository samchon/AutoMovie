import { IAutoFilmFaceTemplate, morphFace } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * MorphFace is plain linear blendshape math: `positions + Σ weight·delta`. The
 * expectation is hand-computed (all values are exact binary fractions, so
 * equality is exact, no float tolerance needed), pinning that multiple
 * parameters accumulate, that a signed weight subtracts, and that a symmetric
 * `both` value drives BOTH per-side eye targets.
 *
 * Scenario: a 2-vertex template with `eyes.both.size` at +0.5 (flattened onto
 * `eyeSizeR` AND `eyeSizeL`) and `jaw.width` at -1: vertex math gives [1 +
 * .5·.25 + .5·.15 - 1·.5, …] = [0.7, 2.2, 0, -1, 1, 0.3].
 */
export const test_face_morph_apply = (): void => {
  const template: IAutoFilmFaceTemplate = {
    positions: [1, 2, 0, -1, 1, 0],
    targets: {
      eyeSizeR: [0.25, 0.25, 0, 0, 0, 0.5],
      eyeSizeL: [0.15, 0.15, 0, 0, 0, 0.1],
      jawWidth: [0.5, 0, 0, 0, 0, 0],
    },
  };
  const result = morphFace({
    template,
    face: makeFace({ eyes: { both: { size: 0.5 } }, jaw: { width: -1 } }),
  });
  TestValidator.equals(
    "accumulated signed morph",
    result,
    [0.7, 2.2, 0, -1, 1, 0.3],
  );
};
