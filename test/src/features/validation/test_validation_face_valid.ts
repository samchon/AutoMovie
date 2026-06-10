import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * Face trait weights are signed morph weights documented to [-2, 2]; a document
 * whose present fields all sit inside (including exactly on) that bound
 * validates — the "valid face passes" baseline, pinning both limits so the
 * boundary itself is legal and omitted fields stay legal by absence.
 *
 * Scenario: `eyeSize` at the +2 limit, `jawWidth` at the -2 limit, and
 * `noseWidth` at 0.4 succeed with no violations.
 */
export const test_validation_face_valid = (): void => {
  const result = validateFaceResult(
    makeFace({ eyeSize: 2, jawWidth: -2, noseWidth: 0.4 }),
  );
  TestValidator.equals("valid face succeeds", result.success, true);
};
