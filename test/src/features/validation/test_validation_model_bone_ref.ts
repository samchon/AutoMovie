import { validateModel } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A rigid part may be attached to a bone; naming a bone the model's skeleton
 * lacks is a dangling reference, reported as a `type` violation. Pins that
 * part-to-bone wiring is checked.
 *
 * Scenario: a part attached to `jaw` — absent from the test skeleton — fails,
 * with a `type` violation on `attachedBone`.
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
