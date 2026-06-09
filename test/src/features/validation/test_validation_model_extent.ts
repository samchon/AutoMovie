import { validateModel } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Primitive dimensions are rough plain numbers, so their positivity is enforced
 * at runtime by the engine, not by the type. A non-positive extent is a `range`
 * violation.
 *
 * Scenario: a box with width 0 fails, with a `range` violation on the width.
 */
export const test_validation_model_extent = (): void => {
  const base = createModel();
  const model = {
    ...base,
    parts: base.parts.map((p) => ({
      ...p,
      geometry: {
        type: "primitive" as const,
        shape: { type: "box" as const, width: 0, height: 0.6, depth: 0.2 },
      },
    })),
  };
  const result = validateModel({ model });
  TestValidator.equals("zero extent fails", result.success, false);
  TestValidator.predicate(
    "range violation on width",
    hasViolation(result, "range", ".width"),
  );
};
