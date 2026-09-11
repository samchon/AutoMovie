import { TestValidator } from "@nestia/e2e";

import { portraitPoint as p } from "../../subjects/geometry";
import {
  fitPortraitEyeSphere,
  portraitEyeSphereHeight,
  portraitEyeSphereIntersection,
} from "../../subjects/portraitEyeSphere";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Eye curvature is spherical and independent of the aperture's sampling axes.
 * The camera-ray intersection preserves image position instead of overwriting Z.
 *
 * Scenarios:
 * 1. A unit circular rim and radius-two sphere yield centre Z=-sqrt(3).
 *    Reversing both lid curves preserves that camera-facing surface.
 * 2. Equal horizontal/vertical radii have equal heights, and a slanted ray
 *    intersects at the known radius-two surface while remaining collinear.
 * 3. Tangencies remain finite; missing rays, invalid samples and degenerate
 *    lid planes fail before they can introduce NaN into exported geometry.
 */
export const test_subject_eye_sphere = (): void => {
  const upper = [p(-1, 0, 0), p(0, 1, 0), p(1, 0, 0)];
  const lower = [p(-1, 0, 0), p(0, -1, 0), p(1, 0, 0)];
  const ray = p(0, 0, 1);
  const fitted = fitPortraitEyeSphere(upper, lower, ray, 2);
  TestValidator.predicate(
    "independent circle-plane fit",
    nclose(fitted.center.x, 0) &&
      nclose(fitted.center.y, 0) &&
      nclose(fitted.center.z, -Math.sqrt(3)),
  );
  const reversed = fitPortraitEyeSphere(
    [...upper].reverse(),
    [...lower].reverse(),
    ray,
    2,
  );
  TestValidator.predicate(
    "orientation faces the camera",
    nclose(reversed.center.z, fitted.center.z),
  );
  const sphere = { center: p(0, 0, 0), radius: 2 };
  TestValidator.predicate(
    "equal curvature on both axes",
    nclose(portraitEyeSphereHeight(sphere, 1, 0), Math.sqrt(3)) &&
      nclose(portraitEyeSphereHeight(sphere, 0, 1), Math.sqrt(3)) &&
      nclose(portraitEyeSphereHeight(sphere, 0, 0), 2),
  );
  const hit = portraitEyeSphereIntersection(sphere, p(0, 0, 0), p(1, 0, 1));
  TestValidator.predicate(
    "slanted ray keeps image position",
    nclose(hit.x, Math.SQRT2) && nclose(hit.y, 0) && nclose(hit.z, Math.SQRT2),
  );
  const tangent = portraitEyeSphereIntersection(sphere, p(2, 0, 7), ray);
  TestValidator.predicate(
    "exact tangent",
    nclose(tangent.x, 2) &&
      nclose(tangent.z, 0) &&
      nclose(portraitEyeSphereHeight(sphere, 2, 0), 0),
  );
  for (const invalid of [0, -1, NaN, 0.5, 1])
    TestValidator.predicate(
      "invalid or insufficient radius",
      throwsError(() => fitPortraitEyeSphere(upper, lower, ray, invalid)),
    );
  for (const curves of [
    [[], lower],
    [upper, []],
    [upper.map(() => p(0, 0, 0)), lower.map(() => p(0, 0, 0))],
    [[p(NaN, 0, 0), ...upper], lower],
  ])
    TestValidator.predicate(
      "invalid lid data",
      throwsError(() => fitPortraitEyeSphere(curves[0], curves[1], ray, 2)),
    );
  TestValidator.predicate(
    "fit refuses absent viewing direction",
    throwsError(() => fitPortraitEyeSphere(upper, lower, p(0, 0, 0), 2)),
  );
  for (const origin of [p(3, 0, 0), p(NaN, 0, 0)])
    TestValidator.predicate(
      "missed or invalid eye ray",
      throwsError(() => portraitEyeSphereIntersection(sphere, origin, ray)),
    );
  TestValidator.predicate(
    "intersection refuses absent direction",
    throwsError(() =>
      portraitEyeSphereIntersection(sphere, p(0, 0, 0), p(0, 0, 0)),
    ),
  );
  for (const x of [2.001, NaN])
    TestValidator.predicate(
      "outside sphere height",
      throwsError(() => portraitEyeSphereHeight(sphere, x, 0)),
    );
};
