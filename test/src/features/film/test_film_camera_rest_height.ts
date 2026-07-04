import { computeRestHeight } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/**
 * Pins the rig-measured subject height the framing grammar depends on. The
 * shared fixture skeleton composes (identity rest rotations, so world Y is a
 * plain running sum) to head at y = 1 + 0.2 + 0.2 + 0.2 + 0.1 = 1.7 and the
 * left lower leg at y = 1 ??0.1 ??0.4 = 0.5 ??a hand-computed extent of 1.2.
 *
 * Scenarios:
 *
 * 1. `createSkeleton()` ??height 1.2 (oracle above, not the code's echo).
 * 2. A skeleton with no bones ??0 (the caller substitutes the default subject
 *    height).
 */
export const test_film_camera_rest_height = (): void => {
  TestValidator.predicate(
    "fixture skeleton measures 1.2 m",
    nclose(computeRestHeight(createSkeleton()), 1.2),
  );
  TestValidator.equals(
    "boneless skeleton measures 0",
    computeRestHeight({ id: "empty", bones: [] }),
    0,
  );
};
