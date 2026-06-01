import { validateModel } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";

/**
 * A well-formed model (one primitive part, resolved material, positive extents)
 * validates successfully.
 */
export const test_validation_model_valid = (): void => {
  const result = validateModel({ model: createModel() });
  TestValidator.equals("valid model succeeds", result.success, true);
};
