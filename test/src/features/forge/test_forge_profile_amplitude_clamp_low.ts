import { fitProfileAmplitude } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * The floor twin of the ceiling clamp: an amplitude below 0.2 would flatten the
 * face into a relief, so the result clamps at the floor.
 *
 * Scenario: a synthetic curve built at alpha 0.05 returns exactly 0.2.
 */
export const test_forge_profile_amplitude_clamp_low = (): void => {
  const noseY = 100;
  const chinY = 160;
  const noseRow = 50;
  const ext = new Array<number>(200).fill(-1);
  const skin = new Array<boolean>(200).fill(true);
  for (let yP = noseRow; yP < 200; yP++) ext[yP] = 240 + 0.05 * -(yP - noseRow);
  const fit = fitProfileAmplitude({
    midline: [
      { y: noseY, z: 0 },
      { y: chinY, z: -(chinY - noseY) },
    ],
    curve: { ext, skin, noseRow },
    noseY,
    chinY,
  });
  TestValidator.equals("floor clamp", fit.alpha, 0.2);
};
