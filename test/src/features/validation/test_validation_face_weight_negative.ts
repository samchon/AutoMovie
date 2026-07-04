import { validateFaceResult } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * Face weights are signed, so the range check must fire on the negative side
 * too — shrinking past the limit is as illegal as growing past it.
 *
 * Scenario: `jaw.width: -2.1` (a jaw group with no chin) fails with a `range`
 * violation on `.jaw.width`.
 */
export const test_validation_face_weight_negative = (): void => {
  const result = validateFaceResult(makeFace({ jaw: { width: -2.1 } }));
  TestValidator.equals("below-range weight fails", result.success, false);
  TestValidator.predicate(
    "range violation on the field",
    result.success === false &&
      result.violations.some(
        (v) => v.kind === "range" && v.path.includes(".jaw.width"),
      ),
  );
};
