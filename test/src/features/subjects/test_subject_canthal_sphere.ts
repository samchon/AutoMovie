import { fitPortraitCanthalSphere } from "@automovie/human/geometry/fitPortraitCanthalSphere";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Optical radius and fixed canthal position can coexist when only supported
 * rim rays fit the spherical body. Expectations below follow the circle
 * equation and intersection of forward-depth half-lines in millimetres.
 *
 * Scenarios:
 * 1. A ten-mm aperture around a radius-three body fits its two central rays
 *    at depth -sqrt(8); exterior canthi do not enlarge that body.
 * 2. An asymmetric pair inside the projected disk constrains depth to
 *    -3-sqrt(5), while a positive lift refuses and a negative lift remains valid.
 * 3. Invalid curves, coordinates, dimensions and direction refuse beside the
 *    valid inputs, including unsupported rays and finite arithmetic overflow.
 */
export const test_subject_canthal_sphere = (): void => {
  const p = (x: number, y: number, z = 0) => ({ x, y, z });
  const upper = [p(-5, 0), p(0, 1), p(5, 0)];
  const lower = [p(-5, 0), p(0, -1), p(5, 0)];
  const ray = p(0, 0, 1);
  const before = structuredClone({ upper, lower, ray });
  const sphere = fitPortraitCanthalSphere(upper, lower, ray, 3);
  TestValidator.predicate(
    "central circle residual",
    nclose(sphere.center.z, -Math.sqrt(8)),
  );
  TestValidator.equals("declared optical radius", sphere.radius, 3);
  TestValidator.equals(
    "transverse canthal midpoint",
    [sphere.center.x, sphere.center.y],
    [0, 0],
  );
  TestValidator.equals(
    "unit ray does not change the fit",
    fitPortraitCanthalSphere(upper, lower, p(0, 0, 5), 3),
    sphere,
  );
  const constrainedUpper = [p(-2, 0, -3), upper[1], p(2, 0, 3)];
  const constrainedLower = [constrainedUpper[0], lower[1], constrainedUpper[2]];
  const constrained = fitPortraitCanthalSphere(
    constrainedUpper,
    constrainedLower,
    ray,
    3,
  );
  TestValidator.predicate(
    "common anchor half-line",
    nclose(constrained.center.z, -3 - Math.sqrt(5)),
  );
  TestValidator.predicate(
    "recess remains feasible",
    nclose(
      fitPortraitCanthalSphere(constrainedUpper, constrainedLower, ray, 3, -1)
        .center.z,
      -4 - Math.sqrt(5),
    ),
  );
  TestValidator.predicate(
    "advance cannot bury an anchor",
    throwsError(
      () =>
        fitPortraitCanthalSphere(
          constrainedUpper,
          constrainedLower,
          ray,
          3,
          0.1,
        ),
      "visible canthi",
    ),
  );
  for (const invalid of [
    () => fitPortraitCanthalSphere([], lower, ray, 3),
    () => fitPortraitCanthalSphere(upper, [], ray, 3),
    () => fitPortraitCanthalSphere(upper, lower, ray, 0),
    () => fitPortraitCanthalSphere(upper, lower, ray, NaN),
    () => fitPortraitCanthalSphere(upper, lower, ray, 3, Infinity),
    () => fitPortraitCanthalSphere(upper, lower, p(0, 0), 3),
    () =>
      fitPortraitCanthalSphere([upper[0], p(NaN, 0), upper[2]], lower, ray, 3),
  ])
    TestValidator.predicate(
      "invalid numerical domain",
      throwsError(invalid, "finite curves"),
    );
  for (const invalidLower of [
    [p(-4, 0), lower[1], lower[2]],
    [lower[0], lower[1], p(4, 0)],
  ])
    TestValidator.predicate(
      "both corners must agree",
      throwsError(
        () => fitPortraitCanthalSphere(upper, invalidLower, ray, 3),
        "endpoints",
      ),
    );
  TestValidator.predicate(
    "distinct canthi",
    throwsError(
      () =>
        fitPortraitCanthalSphere(
          [p(0, 0), p(0, 1), p(0, 0)],
          [p(0, 0), p(0, -1), p(0, 0)],
          ray,
          3,
        ),
      "endpoints",
    ),
  );
  TestValidator.predicate(
    "unsupported opening",
    throwsError(
      () =>
        fitPortraitCanthalSphere(
          [upper[0], p(0, 5), upper[2]],
          [lower[0], p(0, -5), lower[2]],
          ray,
          3,
        ),
      "at least one",
    ),
  );
  TestValidator.predicate(
    "overflowed residual",
    throwsError(
      () => fitPortraitCanthalSphere(upper, lower, ray, 1e200),
      "finite domain",
    ),
  );
  const farUpper = upper.map((q) => p(8e307, q.x, q.y));
  const farLower = lower.map((q) => p(8e307, q.x, q.y));
  TestValidator.predicate(
    "overflowed placement",
    throwsError(
      () => fitPortraitCanthalSphere(farUpper, farLower, p(-1, 0), 3, -1e308),
      "finite construction",
    ),
  );
  TestValidator.equals(
    "caller retains its observations",
    { upper, lower, ray },
    before,
  );
};
