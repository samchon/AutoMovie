import {
  assertPortraitEyelashProfile,
  buildPortraitEyelash,
  portraitEyelashParameters,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitEyelashFixture } from "../internal/portraitEyelashFixture";
import { throwsError } from "../internal/predicates";

/**
 * Curved lash controls reject invalid states before sweeping geometry.
 *
 * Scenarios:
 * 1. Each declared endpoint is admitted; adjacent outliers and nonfinite
 *    values refuse on the named field, including incomplete profiles.
 * 2. Finite roots, both sides, progress endpoints and a safe index are valid.
 *    Bad roots, sides, progress and indices refuse independently.
 */
export const test_subject_lash_refusals = (): void => {
  const profile = portraitEyelashFixture();
  for (const parameter of portraitEyelashParameters) {
    for (const value of [parameter.minimum, parameter.maximum])
      TestValidator.predicate(
        "inclusive profile endpoint",
        !throwsError(() =>
          assertPortraitEyelashProfile({ ...profile, [parameter.id]: value }),
        ),
      );
    for (const value of [
      parameter.minimum - 0.001,
      parameter.maximum + 0.001,
      NaN,
      Infinity,
      -Infinity,
      undefined,
    ])
      TestValidator.predicate(
        "invalid named profile field",
        throwsError(
          () =>
            assertPortraitEyelashProfile({ ...profile, [parameter.id]: value }),
          parameter.id,
        ),
      );
  }
  const origin = { x: 0, y: 0, z: 0 };
  const call = (
    point = origin,
    side: "right" | "left" = "right",
    at = 0,
    index = 0,
  ) => buildPortraitEyelash(point, profile, side, at, index);
  TestValidator.predicate(
    "zero progress and index",
    !throwsError(() => call()),
  );
  TestValidator.predicate(
    "end progress and safe index",
    !throwsError(() => call(origin, "left", 1, Number.MAX_SAFE_INTEGER)),
  );
  for (const axis of ["x", "y", "z"])
    TestValidator.predicate(
      "nonfinite root",
      throwsError(() => call({ ...origin, [axis]: NaN }), "finite root"),
    );
  for (const at of [-0.01, 1.01, NaN])
    TestValidator.predicate(
      "invalid progress",
      throwsError(() => call(origin, "right", at)),
    );
  for (const index of [-1, 0.5, NaN, Number.MAX_SAFE_INTEGER + 1])
    TestValidator.predicate(
      "invalid strand index",
      throwsError(() => call(origin, "right", 0, index)),
    );
  TestValidator.predicate(
    "unknown anatomical side",
    throwsError(() => call(origin, "middle" as "right")),
  );
  TestValidator.predicate(
    "short thick curled strand refuses its inner fold",
    throwsError(
      () =>
        buildPortraitEyelash(
          origin,
          { ...profile, length: 0.1, radius: 0.2, curl: 120 },
          "left",
          0.5,
          0,
        ),
      "curvature radius",
    ),
  );
  TestValidator.predicate(
    "same thick straight strand has no curvature singularity",
    !throwsError(() =>
      buildPortraitEyelash(
        origin,
        { ...profile, length: 0.1, radius: 0.2, curl: 0 },
        "left",
        0.5,
        0,
      ),
    ),
  );
};
