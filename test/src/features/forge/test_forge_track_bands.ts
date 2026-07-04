import { trackSilhouetteBands } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * Band tracking follows the subject by run continuity, not by size: the first
 * row seeds with its widest run, and every later row picks the run with the
 * largest overlap against the previous choice ??a wider detached spur (a
 * ribbon) must lose to the narrower run that continues the head.
 *
 * Scenario: row 0 picks [10, 30] over [40, 45]; row 1 offers a spur [32, 90]
 * (wider) and the continuing [12, 28] ??overlap wins, so the band stays on [12,
 * 28].
 */
export const test_forge_track_bands = (): void => {
  const bands = trackSilhouetteBands([
    {
      y: 0,
      runs: [
        [40, 45],
        [10, 30],
      ],
    },
    {
      y: 1,
      runs: [
        [32, 90],
        [12, 28],
      ],
    },
  ]);
  TestValidator.equals("seed picks the widest run", bands[0], {
    y: 0,
    min: 10,
    max: 30,
  });
  TestValidator.equals("continuity beats width", bands[1], {
    y: 1,
    min: 12,
    max: 28,
  });
};
