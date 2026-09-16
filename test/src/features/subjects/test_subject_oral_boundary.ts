import { tracePortraitOralBoundary } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitOralLiningFixture } from "../internal/portraitOralLiningFixture";

/**
 * The shared oral attachment keeps the skin's oriented free cycle independent
 * of the cavity shape. The fixture is an analytic square annulus in head mm;
 * its inner and outer loops have opposite winding, specified by construction.
 * Existing lining refusal scenarios cover incomplete and nonmanifold inputs.
 *
 * Scenarios:
 * 1. The inner seed selects the clockwise inner square in original index order;
 *    rotating the seed rotates that same cycle without reconstructing points.
 * 2. An outer seed selects the counterclockwise outer square independently.
 * 3. Returned indices and repeated calls preserve caller-owned input arrays.
 */
export const test_subject_oral_boundary = (): void => {
  const surface = portraitOralLiningFixture();
  const saved = structuredClone(surface);
  const boundary = tracePortraitOralBoundary(surface, 0);
  TestValidator.equals("inner clockwise cycle", boundary, [0, 1, 2, 3]);
  TestValidator.equals(
    "same cycle with rotated seed",
    tracePortraitOralBoundary(surface, 2),
    [2, 3, 0, 1],
  );
  TestValidator.equals(
    "independent outer cycle",
    tracePortraitOralBoundary(surface, 4),
    [4, 7, 6, 5],
  );
  boundary[0] = 999;
  TestValidator.equals("caller owns input", surface, saved);
  TestValidator.equals(
    "fresh returned indices",
    tracePortraitOralBoundary(surface, 0),
    [0, 1, 2, 3],
  );
};
