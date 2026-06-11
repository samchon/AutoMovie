import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * Weights are rough plain numbers, so the [-2, 2] bound is enforced at runtime
 * by the engine rather than by the type — on the EFFECTIVE per-side weight.
 * Under the side rule a lone side sources BOTH targets, so one illegal value
 * fails on both sides, and each violation points at the one field the document
 * actually spells.
 *
 * Scenario: a lone `eyes.left.size: 2.1` mirrors to both eyes — two `range`
 * violations, both at `.eyes.left.size`.
 */
export const test_validation_face_weight_range = (): void => {
  const result = validateFaceResult(
    makeFace({ eyes: { left: { size: 2.1 } } }),
  );
  TestValidator.equals("out-of-range weight fails", result.success, false);
  TestValidator.predicate(
    "both mirrored targets violate at the source field",
    result.success === false &&
      result.violations.length === 2 &&
      result.violations.every(
        (v) => v.kind === "range" && v.path.includes(".eyes.left.size"),
      ),
  );
};
