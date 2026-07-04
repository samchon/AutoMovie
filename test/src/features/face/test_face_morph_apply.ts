import { IautomovieFaceTemplate, morphFace } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * MorphFace is plain linear blendshape math: `positions + 誇 weight쨌delta`. The
 * expectation is hand-computed (all values are exact binary fractions, so
 * equality is exact, no float tolerance needed), pinning that multiple
 * parameters accumulate, that a signed weight subtracts, and that the side
 * rule's lone side drives BOTH per-side eye targets.
 *
 * Scenario: a 2-vertex template with a lone `eyes.left.size` at +0.5 (mirrored
 * onto `eyeSizeR` AND `eyeSizeL`) and `jaw.width` at -1: vertex math gives [1 +
 * .5쨌.25 + .5쨌.15 - 1쨌.5, ?? = [0.7, 2.2, 0, -1, 1, 0.3].
 */
export const test_face_morph_apply = (): void => {
  const template: IautomovieFaceTemplate = {
    positions: [1, 2, 0, -1, 1, 0],
    targets: {
      eyeSizeR: [0.25, 0.25, 0, 0, 0, 0.5],
      eyeSizeL: [0.15, 0.15, 0, 0, 0, 0.1],
      jawWidth: [0.5, 0, 0, 0, 0, 0],
    },
  };
  const result = morphFace({
    template,
    face: makeFace({ eyes: { left: { size: 0.5 } }, jaw: { width: -1 } }),
  });
  TestValidator.equals(
    "accumulated signed morph",
    result,
    [0.7, 2.2, 0, -1, 1, 0.3],
  );
};
