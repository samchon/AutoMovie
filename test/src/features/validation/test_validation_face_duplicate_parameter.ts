import { validateFaceResult } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Each parameter may appear at most once — two `eyeSize` entries would make the
 * morph result order-dependent, so the duplicate is rejected even when both
 * weights are individually in range.
 *
 * Scenario: `eyeSize` set twice (0.5 and 1.0) fails with a `type` violation on
 * the second entry's parameter, while the distinct `noseWidth` entry alongside
 * raises none.
 */
export const test_validation_face_duplicate_parameter = (): void => {
  const result = validateFaceResult(
    makeFace([
      { parameter: "eyeSize", weight: 0.5 },
      { parameter: "noseWidth", weight: 0.2 },
      { parameter: "eyeSize", weight: 1 },
    ]),
  );
  TestValidator.equals("duplicate parameter fails", result.success, false);
  TestValidator.predicate(
    "type violation on the duplicate",
    hasViolation(result, "type", "parameters[2].parameter"),
  );
};
