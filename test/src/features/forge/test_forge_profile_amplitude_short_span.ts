import { fitProfileAmplitude } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Fewer than 15 usable row pairs at every candidate scale is not enough signal
 * to calibrate against — the fit throws rather than returning a coin-flip
 * amplitude.
 *
 * Scenario: a 5-row nose→chin span throws.
 */
export const test_forge_profile_amplitude_short_span = (): void => {
  const ext = new Array<number>(100).fill(200);
  const skin = new Array<boolean>(100).fill(true);
  TestValidator.predicate(
    "short span throws",
    throwsError(
      () =>
        fitProfileAmplitude({
          midline: [
            { y: 50, z: 0 },
            { y: 55, z: -5 },
          ],
          curve: { ext, skin, noseRow: 40 },
          noseY: 50,
          chinY: 55,
        }),
      "profile span too short to calibrate",
    ),
  );
};
