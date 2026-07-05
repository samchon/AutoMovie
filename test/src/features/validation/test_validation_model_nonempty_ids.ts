import { validateModel } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Model-local identifiers and optional asset references must not be blank.
 * Empty strings can otherwise resolve through sets/maps while still being
 * unusable stable ids in later references and editor surfaces.
 *
 * Scenario: blank model/skeleton/material/part ids plus blank non-null asset
 * and texture ids fail at their own fields.
 */
export const test_validation_model_nonempty_ids = (): void => {
  const base = createModel();
  const invalid = validateModel({
    model: {
      ...base,
      id: "",
      asset: " ",
      skeleton: { ...base.skeleton!, id: " " },
      materials: base.materials.map((material) => ({
        ...material,
        id: "",
        baseColorTexture: " ",
      })),
      parts: base.parts.map((part) => ({
        ...part,
        id: " ",
        material: "",
      })),
    },
  });

  TestValidator.equals("blank ids fail", invalid.success, false);
  TestValidator.predicate(
    "model id violation",
    hasViolation(invalid, "type", "$input.id"),
  );
  TestValidator.predicate(
    "model asset violation",
    hasViolation(invalid, "type", "$input.asset"),
  );
  TestValidator.predicate(
    "skeleton id violation",
    hasViolation(invalid, "type", "$input.skeleton.id"),
  );
  TestValidator.predicate(
    "material id violation",
    hasViolation(invalid, "type", "$input.materials[0].id"),
  );
  TestValidator.predicate(
    "material texture id violation",
    hasViolation(invalid, "type", "$input.materials[0].baseColorTexture"),
  );
  TestValidator.predicate(
    "part id violation",
    hasViolation(invalid, "type", "$input.parts[0].id"),
  );
  TestValidator.predicate(
    "part material reference violation",
    hasViolation(invalid, "type", "$input.parts[0].material"),
  );
};
