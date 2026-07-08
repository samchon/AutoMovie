import { validateModel } from "@automovie/engine";
import { IAutoMovieTransform } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const modelWithBoneRest = (rest: IAutoMovieTransform) => {
  const base = createModel();
  return {
    ...base,
    skeleton:
      base.skeleton === null
        ? null
        : {
            ...base.skeleton,
            bones: base.skeleton.bones.map((bone, i) =>
              i === 0 ? { ...bone, rest } : bone,
            ),
          },
  };
};

/**
 * Skeleton bone rest transforms seed viewer/export/film FK paths. Their TRS
 * components must be finite, rotation must stay unit-length, and scale must
 * remain positive.
 *
 * Scenarios:
 *
 * 1. A valid explicit rest transform still validates.
 * 2. Non-finite rest translation is a range violation.
 * 3. Non-finite rest rotation is a range violation.
 * 4. Finite but non-unit rest rotation is a range violation.
 * 5. Non-positive rest scale is a range violation.
 */
export const test_validation_model_bone_rest_transform = (): void => {
  TestValidator.equals(
    "valid bone rest transform succeeds",
    validateModel({ model: modelWithBoneRest(IDENTITY_TRANSFORM) }).success,
    true,
  );

  const badTranslation = validateModel({
    model: modelWithBoneRest({
      ...IDENTITY_TRANSFORM,
      translation: { ...IDENTITY_TRANSFORM.translation, x: Number.NaN },
    }),
  });
  TestValidator.equals(
    "non-finite rest translation fails",
    badTranslation.success,
    false,
  );
  TestValidator.predicate(
    "range violation on rest translation",
    hasViolation(
      badTranslation,
      "range",
      "$input.skeleton.bones[0].rest.translation.x",
    ),
  );

  const badRotation = validateModel({
    model: modelWithBoneRest({
      ...IDENTITY_TRANSFORM,
      rotation: { ...IDENTITY_TRANSFORM.rotation, w: Number.POSITIVE_INFINITY },
    }),
  });
  TestValidator.equals(
    "non-finite rest rotation fails",
    badRotation.success,
    false,
  );
  TestValidator.predicate(
    "range violation on rest rotation",
    hasViolation(
      badRotation,
      "range",
      "$input.skeleton.bones[0].rest.rotation.w",
    ),
  );

  const nonUnitRotation = validateModel({
    model: modelWithBoneRest({
      ...IDENTITY_TRANSFORM,
      rotation: { ...IDENTITY_TRANSFORM.rotation, w: 2 },
    }),
  });
  TestValidator.equals(
    "non-unit rest rotation fails",
    nonUnitRotation.success,
    false,
  );
  TestValidator.predicate(
    "range violation on rest rotation length",
    hasViolation(
      nonUnitRotation,
      "range",
      "$input.skeleton.bones[0].rest.rotation",
    ),
  );

  const badScale = validateModel({
    model: modelWithBoneRest({
      ...IDENTITY_TRANSFORM,
      scale: { ...IDENTITY_TRANSFORM.scale, y: 0 },
    }),
  });
  TestValidator.equals(
    "non-positive rest scale fails",
    badScale.success,
    false,
  );
  TestValidator.predicate(
    "range violation on rest scale",
    hasViolation(badScale, "range", "$input.skeleton.bones[0].rest.scale.y"),
  );
};
