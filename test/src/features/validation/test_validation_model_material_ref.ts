import { validateModel } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A part cites its material by id; an id absent from the model's materials is a
 * dangling reference, reported as a `type` violation. Pins that material wiring
 * is checked for consistency.
 *
 * Scenario: a part whose material id resolves to nothing in the model fails,
 * with a `type` violation on the part's material.
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
