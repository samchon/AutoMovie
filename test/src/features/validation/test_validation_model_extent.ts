import { validateModel } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A primitive with a non-positive dimension is a `range` violation — the
 * runtime positivity check the rough numeric type does not encode.
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
