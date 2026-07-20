import { validateFaceResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * Face trait weights are signed morph weights documented to [-2, 2]; a document
 * whose effective per-side weights all sit inside (including exactly on) that
 * bound validates: the "valid face passes" baseline, pinning both limits so
 * the boundary itself is legal.
 *
 * Scenario: every singular leaf present, and the paired features exercising the
 * SIDE RULE's compositions: a lone left (mirrors to both eyes), two defined
 * sides (each its own brow), pair-level spacing plus a one-side offset, and a
 * lone right cheek; all in range, no violations.
 */
export const test_validation_face_valid = (): void => {
  const result = validateFaceResult(
    makeFace({
      width: 0.3,
      length: -0.2,
      cheeks: { right: { fullness: -0.3 } },
      jaw: { width: -2, chin: { length: 0.4, protrusion: -0.1 } },
      eyes: {
        spacing: 0.2,
        left: { size: 2, width: 0.2, height: 0.1, tilt: 0.6, offset: -0.2 },
      },
      brows: { left: { height: -0.4 }, right: { height: 0.3 } },
      nose: { length: 0.2, width: 0.4, projection: 0.7 },
      mouth: { width: -0.5, height: 0.2, lips: { fullness: 1.1 } },
    }),
  );
  TestValidator.equals("valid face succeeds", result.success, true);

  // spacing alone (no per-eye objects at all) must also flatten and pass
  const spacingOnly = validateFaceResult(makeFace({ eyes: { spacing: 0.4 } }));
  TestValidator.equals("pair spacing alone valid", spacingOnly.success, true);
};
