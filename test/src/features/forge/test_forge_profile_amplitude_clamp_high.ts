import { fitProfileAmplitude } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * An amplitude beyond 1.5 means the fit is explaining something other than
 * detector flatness/exaggeration (a wrong nose row, a broken curve), so the
 * result clamps at the ceiling instead of propagating a wild scale into the
 * geometry.
 *
 * Scenario: a synthetic curve built at alpha 3 returns exactly 1.5.
 */
export const test_forge_profile_amplitude_clamp_high = (): void => {
  const noseY = 100;
  const chinY = 160;
  const noseRow = 50;
  const ext = new Array<number>(100).fill(-1); // short: large-scale rows overrun it
  const skin = new Array<boolean>(100).fill(true);
  for (let yP = noseRow; yP < 100; yP++) ext[yP] = 240 + 3 * -(yP - noseRow);
  const fit = fitProfileAmplitude({
    midline: [
      { y: noseY, z: 0 },
      { y: chinY, z: -(chinY - noseY) },
    ],
    curve: { ext, skin, noseRow },
    noseY,
    chinY,
  });
  TestValidator.equals("ceiling clamp", fit.alpha, 1.5);
};
