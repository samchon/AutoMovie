import { validateModel } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";

/**
 * A model may be a skeletonless object/prop (`skeleton: null`). Model
 * validation must accept it — there are no bones to resolve `attachedBone`
 * references against, but the parts and materials are still checked. Pins the
 * null-skeleton branch the character-model tests never take.
 *
 * Scenario: the standard valid model with its skeleton stripped to null. Its
 * one primitive part attaches to no bone, so it validates successfully.
 */
export const test_validation_model_object = (): void => {
  const result = validateModel({ model: { ...createModel(), skeleton: null } });
  TestValidator.equals(
    "skeletonless object model is valid",
    result.success,
    true,
  );
};
