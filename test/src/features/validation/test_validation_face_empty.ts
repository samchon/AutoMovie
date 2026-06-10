import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * An empty parameter list means "the template's face unchanged" and is a legal
 * document, not a degenerate one — the editor's no-op. This pins the empty
 * boundary of the parameter loop.
 *
 * Scenario: a face with zero parameters validates successfully.
 */
export const test_validation_face_empty = (): void => {
  const result = validateFaceResult(makeFace());
  TestValidator.equals("empty face succeeds", result.success, true);
};
