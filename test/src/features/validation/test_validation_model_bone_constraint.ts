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
 * 5. A swing-coned flexion range that excludes neutral (min > 0) is a range
 *    violation — the cone is measured from neutral, so no pose satisfies both
 *    the box and the cone, and clampJointRom's cone scale would drop the axis
 *    below its positive min (the #1230 clamp/validate inconsistency at root).
 * 6. The same for an abduction range whose max < 0 (neutral excluded above).
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

  // 5. a swing-coned flexion range that excludes neutral (min > 0)
  const flexionAboveNeutral = validateModel({
    model: modelWithConstraint({
      ...VALID_CONSTRAINT,
      flexion: { min: 10, max: 90 },
    }),
  });
  TestValidator.equals(
    "a swing-coned flexion range excluding neutral fails",
    flexionAboveNeutral.success,
    false,
  );
  TestValidator.predicate(
    "range violation on the neutral-excluding flexion",
    hasViolation(
      flexionAboveNeutral,
      "range",
      "$input.skeleton.bones[0].constraint.flexion",
    ),
  );

  // 6. a swing-coned abduction range that excludes neutral from above (max < 0)
  const abductionBelowNeutral = validateModel({
    model: modelWithConstraint({
      ...VALID_CONSTRAINT,
      abduction: { min: -90, max: -10 },
    }),
  });
  TestValidator.equals(
    "a swing-coned abduction range excluding neutral fails",
    abductionBelowNeutral.success,
    false,
  );
  TestValidator.predicate(
    "range violation on the neutral-excluding abduction",
    hasViolation(
      abductionBelowNeutral,
      "range",
      "$input.skeleton.bones[0].constraint.abduction",
    ),
  );
};
