import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * Weights are rough plain numbers, so the [-2, 2] bound is enforced at runtime
 * by the engine rather than by the type — on the EFFECTIVE per-side weight,
 * since a legal base plus a legal override can still overshoot together. The
 * violation path names the most specific contributor.
 *
 * Scenario: `eyes.both.size: 1.8` plus `eyes.left.size: 0.4` puts the left eye
 * at 2.2 — a `range` violation on `.eyes.left.size` while the right eye (1.8)
 * stays legal.
 */
export const test_validation_face_weight_range = (): void => {
  const result = validateFaceResult(
    makeFace({ eyes: { both: { size: 1.8 }, left: { size: 0.4 } } }),
  );
  TestValidator.equals("out-of-range weight fails", result.success, false);
  TestValidator.predicate(
    "range violation on the overridden side only",
    result.success === false &&
      result.violations.length === 1 &&
      result.violations.some(
        (v) => v.kind === "range" && v.path.includes(".eyes.left.size"),
      ),
  );
};
