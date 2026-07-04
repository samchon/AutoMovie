import { IAutoMovieFaceTemplate, morphFace } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * An empty parameter list returns the template's resting face unchanged, and as
 * a fresh array — morphFace must never alias the template's `positions`, or a
 * later morph would corrupt the shared template.
 *
 * Scenario: zero parameters yield values equal to the template positions while
 * `result !== template.positions` (a copy, not the original).
 */
export const test_face_morph_empty = (): void => {
  const template: IAutoMovieFaceTemplate = {
    positions: [1, 2, 3],
    targets: {},
  };
  const result = morphFace({ template, face: makeFace() });
  TestValidator.equals("unchanged values", result, [1, 2, 3]);
  TestValidator.predicate(
    "a copy, not the template array",
    result !== template.positions,
  );
};
