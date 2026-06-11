import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * Face trait weights are signed morph weights documented to [-2, 2]; a document
 * whose effective per-side weights all sit inside (including exactly on) that
 * bound validates — the "valid face passes" baseline, pinning both limits so
 * the boundary itself is legal.
 *
 * Scenario: every singular leaf present, and the paired features exercising
 * every composition — symmetric base only (cheeks), base + one-side override
 * (eyes.size via left), side-only (eyes.tilt via right, brows via left), the
 * pair-level spacing plus a per-eye offset — all in range, no violations.
 */
export const test_validation_face_valid = (): void => {
  const result = validateFaceResult(
    makeFace({
      width: 0.3,
      length: -0.2,
      cheeks: { both: { fullness: 0.5 } },
      jaw: { width: -2, chin: { length: 0.4, protrusion: -0.1 } },
      eyes: {
        spacing: 0.2,
        both: { size: 1.7, width: 0.2 },
        left: { size: 0.3, offset: -0.1 },
        right: { tilt: 0.6 },
      },
      brows: { left: { height: -0.4 } },
      nose: { length: 0.2, width: 0.4, projection: 0.7 },
      mouth: { width: -0.5, height: 0.2, lips: { fullness: 1.1 } },
    }),
  );
  TestValidator.equals("valid face succeeds", result.success, true);

  // the complementary compositions: pair sets with NO symmetric base at all
  // (side overrides alone) and the reverse (base with no overrides) — every
  // shared/override presence combination must validate
  const flipped = validateFaceResult(
    makeFace({
      eyes: { left: { size: 0.1 } },
      brows: { both: { height: 0.2 } },
      cheeks: { right: { fullness: -0.3 } },
    }),
  );
  TestValidator.equals(
    "side-only / base-only also valid",
    flipped.success,
    true,
  );
};
