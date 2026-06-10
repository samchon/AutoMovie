import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * Weights are rough plain numbers, so the [-2, 2] bound is enforced at runtime
 * by the engine rather than by the type. A weight just past the positive limit
 * is a `range` violation — the negative twin of the valid case's `+2`, and the
 * violation path names the offending field.
 *
 * Scenario: `eyes.size: 2.1` fails with a `range` violation on `.eyes.size`.
 */
export const test_validation_face_weight_range = (): void => {
  const result = validateFaceResult(makeFace({ eyes: { size: 2.1 } }));
  TestValidator.equals("out-of-range weight fails", result.success, false);
  TestValidator.predicate(
    "range violation on the field",
    result.success === false &&
      result.violations.some(
        (v) => v.kind === "range" && v.path.includes(".eyes.size"),
      ),
  );
};
