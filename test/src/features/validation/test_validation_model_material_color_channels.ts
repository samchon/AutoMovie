import { validateModel } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Material colors are consumed directly by viewer materials and glTF export, so
 * every non-null color component must stay finite and within `[0,1]`.
 *
 * Scenarios:
 *
 * 1. A base color with `a: null` and a finite emissive color validates.
 * 2. Non-finite/over-range base alpha is a range violation.
 * 3. Emissive rgb/a channels are range-checked when emissive is present.
 */
export const test_validation_model_material_color_channels = (): void => {
  const base = createModel();
  const valid = validateModel({
    model: {
      ...base,
      materials: base.materials.map((material) => ({
        ...material,
        baseColor: { ...material.baseColor, a: null },
        emissive: { r: 0.1, g: 0.2, b: 0.3, a: null, hex: null },
      })),
    },
  });
  TestValidator.equals(
    "valid material color channels pass",
    valid.success,
    true,
  );

  const invalid = validateModel({
    model: {
      ...base,
      materials: base.materials.map((material) => ({
        ...material,
        baseColor: { ...material.baseColor, a: Number.NaN },
        emissive: {
          r: -0.1,
          g: Number.POSITIVE_INFINITY,
          b: 0.3,
          a: 1.5,
          hex: null,
        },
      })),
    },
  });

  TestValidator.equals(
    "invalid material color channels fail",
    invalid.success,
    false,
  );
  TestValidator.predicate(
    "base alpha violation",
    hasViolation(invalid, "range", "$input.materials[0].baseColor.a"),
  );
  TestValidator.predicate(
    "emissive red violation",
    hasViolation(invalid, "range", "$input.materials[0].emissive.r"),
  );
  TestValidator.predicate(
    "emissive green violation",
    hasViolation(invalid, "range", "$input.materials[0].emissive.g"),
  );
  TestValidator.predicate(
    "emissive alpha violation",
    hasViolation(invalid, "range", "$input.materials[0].emissive.a"),
  );
};
