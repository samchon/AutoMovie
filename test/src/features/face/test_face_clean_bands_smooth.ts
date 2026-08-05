import { cleanSilhouetteBands } from "@automovie/face";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/**
 * The triangular smoothing kernel is normalized: a constant band passes through
 * bit-exact (no drift to lock in), while a step edge is softened, which is the
 * property that keeps band rows from reading as ring banding on the lofted clay
 * surface.
 *
 * Scenario: a constant 20 stays exactly 20 under radius 2; a 0|10 step's corner
 * rows pull toward each other (strictly between the plateau values, symmetric
 * about the step).
 */
export const test_face_clean_bands_smooth = (): void => {
  const constant = cleanSilhouetteBands(
    Array.from({ length: 8 }, (_, y) => ({ y, min: 0, max: 20 })),
    { medianRadius: 0, smoothRadius: 2 },
  );
  TestValidator.predicate(
    "constant is preserved exactly",
    constant.every((b) => b.max === 20),
  );

  const step = cleanSilhouetteBands(
    Array.from({ length: 12 }, (_, y) => ({ y, min: 0, max: y < 6 ? 0 : 10 })),
    { medianRadius: 0, smoothRadius: 2 },
  );
  const before = step[5]!.max;
  const after = step[6]!.max;
  TestValidator.equals(
    "step softened symmetrically",
    namedFacts([
      ["before", () => before > 0],
      ["after", () => after < 10],
      ["ncloseBeforeAfter", () => nclose(before + after, 10, 1e-9)],
    ]),
    { before: true, after: true, ncloseBeforeAfter: true },
  );
};
