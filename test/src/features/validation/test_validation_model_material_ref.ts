import { validateModel } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A part that cites a material id absent from the model is a dangling reference
 * — a `type` violation on the part's material.
 */
export const test_validation_model_material_ref = (): void => {
  const base = createModel();
  const model = {
    ...base,
    parts: base.parts.map((p) => ({ ...p, material: "does-not-exist" })),
  };
  const result = validateModel({ model });
  TestValidator.equals("dangling material fails", result.success, false);
  TestValidator.predicate(
    "type violation on material",
    hasViolation(result, "type", ".material"),
  );
};
