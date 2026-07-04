import { trackSilhouetteBands } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The very first row must offer a run — with nothing to seed from there is no
 * defensible band to emit, so tracking throws instead of inventing one.
 *
 * Scenario: a first row with zero runs throws.
 */
export const test_forge_track_bands_empty_first = (): void => {
  TestValidator.error("run-less first row throws", () =>
    trackSilhouetteBands([{ y: 0, runs: [] }]),
  );
};
