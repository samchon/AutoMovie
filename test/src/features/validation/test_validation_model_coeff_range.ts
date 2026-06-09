import { validateModel } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * PBR material coefficients are rough plain numbers, so their [0,1] bound is an
 * engine runtime check rather than a type constraint. A coefficient outside the
 * range is a `range` violation.
 *
 * Scenario: a material with metallic = 2 fails, with a `range` violation on
 * `metallic`.
 */
export const test_validation_model_coeff_range = (): void => {
  const base = createModel();
  const model = {
    ...base,
    materials: base.materials.map((m) => ({ ...m, metallic: 2 })),
  };
  const result = validateModel({ model });
  TestValidator.equals("out-of-range metallic fails", result.success, false);
  TestValidator.predicate(
    "range violation on metallic",
    hasViolation(result, "range", ".metallic"),
  );
};
