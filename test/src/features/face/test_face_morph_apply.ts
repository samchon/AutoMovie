import { IAutoFilmFaceTemplate, morphFace } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * MorphFace is plain linear blendshape math: `positions + Σ weight·delta`. The
 * expectation is hand-computed (all values are exact binary fractions, so
 * equality is exact, no float tolerance needed), pinning that multiple
 * parameters accumulate and that a signed weight subtracts.
 *
 * Scenario: a 2-vertex template with `eyes.size` at +0.5 and `jaw.width` at -1
 * (flattened onto the `eyeSize`/`jawWidth` targets): vertex math gives [1 +
 * .5·.25 - 1·.5, …] = [0.625, 2.125, 0, -1, 1, 0.25].
 */
export const test_face_morph_apply = (): void => {
  const template: IAutoFilmFaceTemplate = {
    positions: [1, 2, 0, -1, 1, 0],
    targets: {
      eyeSize: [0.25, 0.25, 0, 0, 0, 0.5],
      jawWidth: [0.5, 0, 0, 0, 0, 0],
    },
  };
  const result = morphFace({
    template,
    face: makeFace({ eyes: { size: 0.5 }, jaw: { width: -1 } }),
  });
  TestValidator.equals(
    "accumulated signed morph",
    result,
    [0.625, 2.125, 0, -1, 1, 0.25],
  );
};
