import { validateModel } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A part attached to a bone the model's skeleton lacks is a dangling reference
 * — a `type` violation on `attachedBone` (the test skeleton has no `jaw`).
 */
export const test_validation_model_bone_ref = (): void => {
  const base = createModel();
  const model = {
    ...base,
    parts: base.parts.map((p) => ({ ...p, attachedBone: "jaw" as const })),
  };
  const result = validateModel({ model });
  TestValidator.equals("dangling bone fails", result.success, false);
  TestValidator.predicate(
    "type violation on attachedBone",
    hasViolation(result, "type", ".attachedBone"),
  );
};
