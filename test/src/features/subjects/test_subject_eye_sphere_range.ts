import { TestValidator } from "@nestia/e2e";

import { fitPortraitEyeSphere } from "../../subjects/portraitEyeSphere";
import { throwsError } from "../internal/predicates";

/**
 * Finite radius input must not produce an infinite fitted eye centre.
 * Scenarios:
 * 1. A unit circular rim and radius two give centre Z=-sqrt(3); a much larger
 *    representable squared radius still returns finite coordinates.
 * 2. Radius 1e200 has an unrepresentable square and must refuse before returning
 *    a sphere with an infinite centre to its optical consumers.
 */
export const test_subject_eye_sphere_range = (): void => {
  const p = (x: number, y: number) => ({ x, y, z: 0 });
  const upper = [p(-1, 0), p(0, 1), p(1, 0)],
    lower = [p(-1, 0), p(0, -1), p(1, 0)],
    ray = { x: 0, y: 0, z: 1 };
  const sphere = fitPortraitEyeSphere(upper, lower, ray, 2);
  TestValidator.predicate(
    "hand spherical cap",
    Math.abs(sphere.center.z + Math.sqrt(3)) < 1e-12,
  );
  const large = fitPortraitEyeSphere(upper, lower, ray, 1e154);
  TestValidator.predicate(
    "representable large radius remains valid",
    [large.center.x, large.center.y, large.center.z].every(Number.isFinite),
  );
  TestValidator.predicate(
    "overflowing radius square refuses",
    throwsError(
      () => fitPortraitEyeSphere(upper, lower, ray, 1e200),
      "curvature",
    ),
  );
};
