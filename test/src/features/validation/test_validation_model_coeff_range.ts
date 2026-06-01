import { validateModel } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/** A PBR coefficient outside [0,1] (metallic = 2) is a `range` violation. */
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
