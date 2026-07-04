import { validateModel } from "@automovie/engine";
import { IAutoMovieTransform } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const PART_TRANSFORM: IAutoMovieTransform = {
  translation: { x: 0.1, y: 0.2, z: 0.3 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const modelWithPartTransform = (transform: IAutoMovieTransform) => {
  const base = createModel();
  return {
    ...base,
    parts: base.parts.map((part, i) =>
      i === 0 ? { ...part, transform } : part,
    ),
  };
};

/**
 * Model part transforms are renderer/export-facing TRS data. Non-null
 * transforms must carry finite components, and scale must remain positive.
 *
 * Scenarios:
 *
 * 1. A valid non-null part transform still validates.
 * 2. Non-finite translation is a range violation.
 * 3. Non-finite rotation is a range violation.
 * 4. Non-positive scale is a range violation.
 */
export const test_validation_model_part_transform = (): void => {
  TestValidator.equals(
    "valid part transform succeeds",
    validateModel({ model: modelWithPartTransform(PART_TRANSFORM) }).success,
    true,
  );

  const badTranslation = validateModel({
    model: modelWithPartTransform({
      ...PART_TRANSFORM,
      translation: { ...PART_TRANSFORM.translation, x: Number.NaN },
    }),
  });
  TestValidator.equals(
    "non-finite part translation fails",
    badTranslation.success,
    false,
  );
  TestValidator.predicate(
    "range violation on part translation",
    hasViolation(
      badTranslation,
      "range",
      "$input.parts[0].transform.translation.x",
    ),
  );

  const badRotation = validateModel({
    model: modelWithPartTransform({
      ...PART_TRANSFORM,
      rotation: { ...PART_TRANSFORM.rotation, w: Number.POSITIVE_INFINITY },
    }),
  });
  TestValidator.equals(
    "non-finite part rotation fails",
    badRotation.success,
    false,
  );
  TestValidator.predicate(
    "range violation on part rotation",
    hasViolation(badRotation, "range", "$input.parts[0].transform.rotation.w"),
  );

  const badScale = validateModel({
    model: modelWithPartTransform({
      ...PART_TRANSFORM,
      scale: { ...PART_TRANSFORM.scale, y: 0 },
    }),
  });
  TestValidator.equals(
    "non-positive part scale fails",
    badScale.success,
    false,
  );
  TestValidator.predicate(
    "range violation on part scale",
    hasViolation(badScale, "range", "$input.parts[0].transform.scale.y"),
  );
};
