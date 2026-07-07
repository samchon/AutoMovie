import { detectFreeFall } from "@automovie/engine";
import { IAutoMovieBody } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

const BODY: IAutoMovieBody = {
  mass: 1,
  centerOfMass: null,
  friction: 0.5,
  restitution: 0.5,
};

const fall = (over: { margin?: number; fallDuration?: number }) =>
  detectFreeFall({
    body: BODY,
    centerOfMass: { x: 0, y: 5, z: 0 },
    support: [],
    attached: false,
    falling: false,
    ...over,
  });

/**
 * The free-fall check's rough config scalars are engine runtime checks. A
 * non-finite or negative margin, and a non-finite or non-positive fall duration
 * (the arc must span real time), are `error`-severity range violations that
 * abort the check.
 *
 * Scenarios:
 *
 * 1. A negative margin is a range violation on `margin`.
 * 2. A non-finite margin is a range violation on `margin`.
 * 3. A zero fall duration is a range violation on `fallDuration`.
 * 4. A non-finite fall duration is a range violation on `fallDuration`.
 */
export const test_validation_free_fall_config = (): void => {
  const negMargin = fall({ margin: -1 });
  TestValidator.equals(
    "negative margin fails",
    negMargin.validation.success,
    false,
  );
  TestValidator.predicate(
    "range violation on margin",
    hasViolation(negMargin.validation, "range", ".margin"),
  );
  TestValidator.predicate(
    "range violation on non-finite margin",
    hasViolation(fall({ margin: Number.NaN }).validation, "range", ".margin"),
  );

  const zeroDuration = fall({ fallDuration: 0 });
  TestValidator.equals(
    "zero fallDuration fails",
    zeroDuration.validation.success,
    false,
  );
  TestValidator.predicate(
    "range violation on fallDuration",
    hasViolation(zeroDuration.validation, "range", ".fallDuration"),
  );
  TestValidator.predicate(
    "range violation on non-finite fallDuration",
    hasViolation(
      fall({ fallDuration: Number.POSITIVE_INFINITY }).validation,
      "range",
      ".fallDuration",
    ),
  );
};
