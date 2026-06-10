import { cleanSilhouetteBands } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The max-side monotone clamp starts AT the side's extremum row and only
 * shrinks from there: a spur bulging outward below the extremum is clipped to
 * the running maximum, while rows above the extremum stay free (the skull may
 * widen on the way down to its widest point). `extremumAbove` confines the
 * anchor search so a low spur cannot claim it.
 *
 * Scenario (filters off for exact values): maxes [20, 24, 22, 30, 21] with the
 * extremum search confined to y <= 1 anchors at y=1 (24); the y=3 spur (30)
 * clips to 22 (the running max after 22), the rest pass through.
 */
export const test_forge_clean_bands_mono_max = (): void => {
  const cleaned = cleanSilhouetteBands(
    [20, 24, 22, 30, 21].map((max, y) => ({ y, min: 0, max })),
    { monoMax: true, extremumAbove: 1, medianRadius: 0, smoothRadius: 0 },
  );
  TestValidator.equals(
    "spur clipped, head free above the anchor",
    cleaned.map((b) => b.max),
    [20, 24, 22, 22, 21],
  );
};
