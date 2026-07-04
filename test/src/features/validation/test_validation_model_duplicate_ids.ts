import { validateModel } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Model-local identifiers must be unique. Otherwise references by material id,
 * part id, or bone name become ambiguous and order-dependent.
 *
 * Scenario: duplicate material ids, part ids, and skeleton bone names all
 * produce type violations at the duplicate entries.
 */
export const test_validation_model_duplicate_ids = (): void => {
  const base = createModel();
  const skeleton = base.skeleton!;
  const duplicate = validateModel({
    model: {
      ...base,
      materials: [
        base.materials[0]!,
        { ...base.materials[0]!, name: "duplicate material" },
      ],
      parts: [base.parts[0]!, { ...base.parts[0]!, name: "duplicate part" }],
      skeleton: {
        ...skeleton,
        bones: [
          skeleton.bones[0]!,
          { ...skeleton.bones[1]!, bone: skeleton.bones[0]!.bone },
        ],
      },
    },
  });

  TestValidator.equals("duplicate identifiers fail", duplicate.success, false);
  TestValidator.predicate(
    "duplicate material id violation",
    hasViolation(duplicate, "type", "$input.materials[1].id"),
  );
  TestValidator.predicate(
    "duplicate part id violation",
    hasViolation(duplicate, "type", "$input.parts[1].id"),
  );
  TestValidator.predicate(
    "duplicate skeleton bone violation",
    hasViolation(duplicate, "type", "$input.skeleton.bones[1].bone"),
  );
};
