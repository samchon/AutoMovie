import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * Face trait weights are signed morph weights documented to [-2, 2]; a document
 * whose present leaves all sit inside (including exactly on) that bound
 * validates — the "valid face passes" baseline, pinning both limits so the
 * boundary itself is legal.
 *
 * Scenario: every leaf of the nested document present — the limits on
 * `eyes.size` (+2) and `jaw.width` (-2), moderate values elsewhere — succeeds
 * with no violations, proving the whole anatomy tree (including the `jaw.chin`
 * and `mouth.lips` sub-groups) flattens and validates.
 */
export const test_validation_face_valid = (): void => {
  const result = validateFaceResult(
    makeFace({
      width: 0.3,
      length: -0.2,
      cheeks: { fullness: 0.5 },
      jaw: { width: -2, chin: { length: 0.4, protrusion: -0.1 } },
      eyes: { size: 2, width: 0.2, spacing: -0.3, height: 0.1, tilt: 0.6 },
      brows: { height: -0.4 },
      nose: { length: 0.2, width: 0.4, projection: 0.7 },
      mouth: { width: -0.5, height: 0.2, lips: { fullness: 1.1 } },
    }),
  );
  TestValidator.equals("valid face succeeds", result.success, true);
};
