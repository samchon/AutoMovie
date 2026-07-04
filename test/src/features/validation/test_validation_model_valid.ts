import { validateModel } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";

/**
 * A well-formed model validates: at least one part, resolved material
 * references, and positive primitive extents. The "valid model passes" baseline
 * above the structural failure cases.
 *
 * Scenario: the standard one-part generated model (a box with a resolved
 * material) succeeds.
 */
export const test_validation_model_valid = (): void => {
  const result = validateModel({ model: createModel() });
  TestValidator.equals("valid model succeeds", result.success, true);
};
