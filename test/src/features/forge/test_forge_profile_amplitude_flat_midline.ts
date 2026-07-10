import { fitProfileAmplitude } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * An all-zero midline (flat detected depth) has no amplitude to solve for: `saa
 * = 0` makes the least-squares alpha `0/0 = NaN`, and NaN used to sidestep both
 * the best-candidate comparison and the documented `[0.2, 1.5]` clamp (every
 * comparison with NaN is false), silently multiplying every detected depth into
 * NaN vertices downstream (#1043). A degenerate profile must throw exactly like
 * the short span does.
 *
 * Scenario: a 60-row nose→chin span whose midline z is identically 0 throws
 * instead of returning `{ alpha: NaN }`.
 */
export const test_forge_profile_amplitude_flat_midline = (): void => {
  const ext = new Array<number>(200).fill(200);
  const skin = new Array<boolean>(200).fill(true);
  TestValidator.predicate(
    "flat midline throws instead of emitting NaN",
    throwsError(
      () =>
        fitProfileAmplitude({
          midline: [
            { y: 50, z: 0 },
            { y: 110, z: 0 },
          ],
          curve: { ext, skin, noseRow: 40 },
          noseY: 50,
          chinY: 110,
        }),
      "profile span too short to calibrate",
    ),
  );
};
