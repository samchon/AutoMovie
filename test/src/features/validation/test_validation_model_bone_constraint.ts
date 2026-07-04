import { validateModel } from "@automovie/engine";
import { IAutoMovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const VALID_CONSTRAINT: IAutoMovieJointConstraint = {
  flexion: { min: -10, max: 10 },
  abduction: null,
  twist: { min: -5, max: 5 },
  swingDeg: 30,
};

const modelWithConstraint = (constraint: IAutoMovieJointConstraint) => {
  const base = createModel();
  return {
    ...base,
    skeleton:
      base.skeleton === null
        ? null
        : {
            ...base.skeleton,
            bones: base.skeleton.bones.map((bone, i) =>
              i === 0 ? { ...bone, constraint } : bone,
            ),
          },
  };
};

/**
 * Skeleton ROM overrides are model AST constraints. Their scalar ranges must be
 * finite and ordered before pose validation consumes them.
 *
 * Scenarios:
 *
 * 1. A valid explicit constraint still validates.
 * 2. Non-finite axis range bounds are range violations.
 * 3. Inverted axis ranges are range violations.
 * 4. Non-positive swing cones are range violations.
 */
export const test_validation_model_bone_constraint = (): void => {
  TestValidator.equals(
    "valid constraint succeeds",
    validateModel({ model: modelWithConstraint(VALID_CONSTRAINT) }).success,
    true,
  );
  TestValidator.equals(
    "null swing constraint succeeds",
    validateModel({
      model: modelWithConstraint({ ...VALID_CONSTRAINT, swingDeg: null }),
    }).success,
    true,
  );

  const nonFinite = validateModel({
    model: modelWithConstraint({
      ...VALID_CONSTRAINT,
      flexion: { min: Number.NaN, max: 10 },
    }),
  });
  TestValidator.equals(
    "non-finite constraint bound fails",
    nonFinite.success,
    false,
  );
  TestValidator.predicate(
    "range violation on non-finite bound",
    hasViolation(
      nonFinite,
      "range",
      "$input.skeleton.bones[0].constraint.flexion.min",
    ),
  );

  const inverted = validateModel({
    model: modelWithConstraint({
      ...VALID_CONSTRAINT,
      twist: { min: 15, max: -15 },
    }),
  });
  TestValidator.equals("inverted constraint fails", inverted.success, false);
  TestValidator.predicate(
    "range violation on inverted range",
    hasViolation(
      inverted,
      "range",
      "$input.skeleton.bones[0].constraint.twist",
    ),
  );

  const badSwing = validateModel({
    model: modelWithConstraint({
      ...VALID_CONSTRAINT,
      swingDeg: 0,
    }),
  });
  TestValidator.equals(
    "non-positive swing cone fails",
    badSwing.success,
    false,
  );
  TestValidator.predicate(
    "range violation on swingDeg",
    hasViolation(
      badSwing,
      "range",
      "$input.skeleton.bones[0].constraint.swingDeg",
    ),
  );
};
