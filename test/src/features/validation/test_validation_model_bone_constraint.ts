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
 * 5. A swing-coned constraint whose box and cone do NOT intersect is a range
 *    violation on `swingDeg`: the most-retracted articulation the ranges allow
 *    already swings past the cone, so no pose satisfies both (#1245). Reported
 *    against the cone, since the ranges alone are unobjectionable.
 * 6. The non-firing twins: a box that excludes neutral but sits INSIDE a wide
 *    cone is sound and must validate, in both the `min > 0` and `max < 0`
 *    directions. Rejecting these refused rigs the per-bone override exists to
 *    express (a limb that cannot fully extend), on a false premise (#1245).
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

  // 5. box ∩ cone empty: the most-retracted articulation the ranges allow is
  // (10, 10), which already swings 14.1°, past this 5° cone. No pose satisfies
  // both, so the constraint is genuinely unsatisfiable.
  const emptyIntersection = validateModel({
    model: modelWithConstraint({
      flexion: { min: 10, max: 90 },
      abduction: { min: 10, max: 90 },
      twist: null,
      swingDeg: 5,
    }),
  });
  TestValidator.equals(
    "a constraint whose box and cone cannot intersect fails",
    emptyIntersection.success,
    false,
  );
  TestValidator.predicate(
    "the violation is reported against the cone, naming the minimum swing",
    hasViolation(
      emptyIntersection,
      "range",
      "$input.skeleton.bones[0].constraint.swingDeg",
    ),
  );

  // 5b. a malformed bound on a swung axis is reported as itself and does not
  // also manufacture a bogus cone verdict out of NaN. Both directions of the
  // guard: a non-finite min (above) and a non-finite max (here).
  const nonFiniteMax = validateModel({
    model: modelWithConstraint({
      ...VALID_CONSTRAINT,
      flexion: { min: -10, max: Number.NaN },
    }),
  });
  TestValidator.predicate(
    "a non-finite max is reported on the bound itself",
    hasViolation(
      nonFiniteMax,
      "range",
      "$input.skeleton.bones[0].constraint.flexion.max",
    ),
  );
  TestValidator.predicate(
    "and does not add a spurious swingDeg violation",
    !hasViolation(
      nonFiniteMax,
      "range",
      "$input.skeleton.bones[0].constraint.swingDeg",
    ),
  );

  // 6. the non-firing twins: a box that excludes neutral but sits inside a wide
  // cone admits poses and must validate. Oracle: the most-retracted pose is
  // (10, 0): swingConeAngle(10, 0) = 10°, comfortably inside a 95° cone.
  TestValidator.equals(
    "a neutral-excluding flexion range inside a wide cone succeeds",
    validateModel({
      model: modelWithConstraint({
        flexion: { min: 10, max: 90 },
        abduction: { min: -90, max: 90 },
        twist: null,
        swingDeg: 95,
      }),
    }).success,
    true,
  );
  TestValidator.equals(
    "a neutral-excluding abduction range (max < 0) inside a wide cone succeeds",
    validateModel({
      model: modelWithConstraint({
        flexion: { min: -90, max: 90 },
        abduction: { min: -90, max: -10 },
        twist: null,
        swingDeg: 95,
      }),
    }).success,
    true,
  );
};
