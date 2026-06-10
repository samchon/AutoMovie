import { cleanSilhouetteBands } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The median prefilter exists for one-off tracking glitches: a single-row
 * outlier disappears while the surrounding plateau is untouched (a mean would
 * smear the spike into its neighbors instead).
 *
 * Scenario: maxes [20, 20, 90, 20, 20] with medianRadius 1 (and no other
 * cleaning) come out flat at 20.
 */
export const test_forge_clean_bands_median = (): void => {
  const cleaned = cleanSilhouetteBands(
    [20, 20, 90, 20, 20].map((max, y) => ({ y, min: 0, max })),
    { medianRadius: 1, smoothRadius: 0 },
  );
  TestValidator.equals(
    "single-row glitch removed",
    cleaned.map((b) => b.max),
    [20, 20, 20, 20, 20],
  );
};
