import { cleanSilhouetteBands } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The min side mirrors the max side: after its extremum (the leftmost reach),
 * the min may only move inward (non-decreasing) — a spur jutting left below the
 * head is clipped back to the running minimum.
 *
 * Scenario (filters off): mins [10, 6, 8, 2, 9] anchor at y=1 (6); the y=3 spur
 * (2) clips to 8, and y=4 keeps its own 9 (already inside).
 */
export const test_forge_clean_bands_mono_min = (): void => {
  const cleaned = cleanSilhouetteBands(
    [10, 6, 8, 2, 9].map((min, y) => ({ y, min, max: 50 })),
    { monoMin: true, extremumAbove: 1, medianRadius: 0, smoothRadius: 0 },
  );
  TestValidator.equals(
    "left spur clipped after the extremum",
    cleaned.map((b) => b.min),
    [10, 6, 8, 8, 9],
  );
};
