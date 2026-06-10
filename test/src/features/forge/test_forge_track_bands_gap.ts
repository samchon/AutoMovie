import { trackSilhouetteBands } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * A row whose runs all miss the previous band (or that has no runs at all)
 * keeps the previous band, so a one-row mask dropout cannot derail the track
 * onto a detached spur.
 *
 * Scenario: after seeding on [10, 30], a row holding only the disjoint [50, 60]
 * keeps [10, 30], and a run-less row keeps it again.
 */
export const test_forge_track_bands_gap = (): void => {
  const bands = trackSilhouetteBands([
    { y: 0, runs: [[10, 30]] },
    { y: 1, runs: [[50, 60]] },
    { y: 2, runs: [] },
  ]);
  TestValidator.equals("disjoint row keeps the band", bands[1], {
    y: 1,
    min: 10,
    max: 30,
  });
  TestValidator.equals("empty row keeps the band", bands[2], {
    y: 2,
    min: 10,
    max: 30,
  });
};
