import { portraitPoint as p } from "@automovie/human/geometry/geometry";
import {
  fitPortraitEyeSphere,
  portraitEyeSphereIntersection,
} from "@automovie/human/geometry/portraitEyeSphere";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * A depth-tilted rim can retain its observed projection without treating the
 * rim plane as the optical axis. Alignment remains an explicit identity choice.
 *
 * Scenarios:
 * 1. A unit projected circle with Z=Y fits at (0,0,-sqrt(3)) along the Z ray;
 *    the legacy tilted-plane centre differs, and explicit legacy equals omission.
 * 2. A nonunit ray and reversed winding retain that centre. Translation and
 *    a quarter-turn into an X-facing frame preserve the same construction.
 * 3. Radius 1.1 admits projected support even though it cannot span the tilted
 *    plane. Radius one, a degenerate rim and an unknown alignment still refuse.
 */
export const test_subject_eye_sphere_alignment = (): void => {
  const upper = [p(-1, 0, 0), p(0, 1, 1), p(1, 0, 0)];
  const lower = [p(-1, 0, 0), p(0, -1, -1), p(1, 0, 0)];
  const ray = p(0, 0, 1);
  const legacy = fitPortraitEyeSphere(upper, lower, ray, 2);
  TestValidator.equals(
    "explicit default keeps original arithmetic",
    fitPortraitEyeSphere(upper, lower, ray, 2, "aperture-plane"),
    legacy,
  );
  const observed = fitPortraitEyeSphere(
    upper,
    lower,
    ray,
    2,
    "observation-ray",
  );
  TestValidator.predicate(
    "projected circle hand centre",
    nclose(observed.center.x, 0) &&
      nclose(observed.center.y, 0) &&
      nclose(observed.center.z, -Math.sqrt(3)) &&
      legacy.center.y > 1,
  );
  const reversed = fitPortraitEyeSphere(
    [...upper].reverse(),
    [...lower].reverse(),
    p(0, 0, 7),
    2,
    "observation-ray",
  );
  TestValidator.predicate(
    "direction scale and winding are not identity changes",
    nclose(reversed.center.x, observed.center.x) &&
      nclose(reversed.center.y, observed.center.y) &&
      nclose(reversed.center.z, observed.center.z),
  );
  const turn = (point: { x: number; y: number; z: number }) =>
    p(point.z + 4, point.y + 5, -point.x + 6);
  const moved = fitPortraitEyeSphere(
    upper.map(turn),
    lower.map(turn),
    p(3, 0, 0),
    2,
    "observation-ray",
  );
  TestValidator.predicate(
    "rigid-frame covariance",
    nclose(moved.center.x, 4 - Math.sqrt(3)) &&
      nclose(moved.center.y, 5) &&
      nclose(moved.center.z, 6),
  );
  const tight = fitPortraitEyeSphere(upper, lower, ray, 1.1, "observation-ray");
  for (const point of [...upper, ...lower]) {
    const contact = portraitEyeSphereIntersection(tight, point, ray);
    TestValidator.predicate(
      "every original projection still intersects",
      nclose(contact.x, point.x) &&
        nclose(contact.y, point.y) &&
        nclose(
          Math.hypot(contact.x, contact.y, contact.z - tight.center.z),
          1.1,
        ),
    );
  }
  TestValidator.predicate(
    "the same radius cannot span the tilted plane",
    throwsError(
      () => fitPortraitEyeSphere(upper, lower, ray, 1.1),
      "curvature",
    ),
  );
  TestValidator.predicate(
    "zero spherical clearance refuses",
    throwsError(
      () => fitPortraitEyeSphere(upper, lower, ray, 1, "observation-ray"),
      "curvature",
    ),
  );
  TestValidator.predicate(
    "degenerate rim still refuses",
    throwsError(
      () => fitPortraitEyeSphere(upper, upper, ray, 2, "observation-ray"),
      "nondegenerate",
    ),
  );
  TestValidator.predicate(
    "unknown mode refuses",
    throwsError(() =>
      fitPortraitEyeSphere(
        upper,
        lower,
        ray,
        2,
        "unknown" as "observation-ray",
      ),
    ),
  );
};
