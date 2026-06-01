import { validateModel } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A model needs at least one part — there must be something to render. An empty
 * `parts` list is a `type` violation. Pins the minimal structural requirement.
 *
 * Scenario: the standard model with its parts emptied fails, with a `type`
 * violation on `parts`.
 */
export const test_validation_model_no_parts = (): void => {
  const result = validateModel({ model: { ...createModel(), parts: [] } });
  TestValidator.equals("empty model fails", result.success, false);
  TestValidator.predicate(
    "type violation on parts",
    hasViolation(result, "type", ".parts"),
  );
};
