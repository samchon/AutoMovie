import { fitProfileAmplitude } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * A midline whose last sample sits above the chin still calibrates: queries
 * past the sampled span clamp to the final depth, so a sparsely sampled lower
 * jaw cannot crash or skew the fit when the photo agrees with the clamped
 * extension.
 *
 * Scenario: a kinked midline anchored at the nose (y 100, z 0) but ending at y
 * 140 inside a nose..chin span of 100..160; the profile is built from the same
 * clamped extension at alpha 0.5 / rowScale 0.8 ??both come back.
 */
export const test_forge_profile_amplitude_clamped_ends = (): void => {
  const noseY = 100;
  const chinY = 160;
  const noseRow = 50;
  const midline = [
    { y: 100, z: 0 },
    { y: 125, z: -25 },
    { y: 140, z: -30 },
  ];
  const midZ = (y: number): number =>
    y <= 125 ? -(y - 100) : y <= 140 ? -25 - (y - 125) / 3 : -30;

  const ext = new Array<number>(220).fill(-1);
  const skin = new Array<boolean>(220).fill(true);
  for (let yP = noseRow; yP < 220; yP++) {
    const yF = noseY + (yP - noseRow) / 0.8;
    ext[yP] = 240 + 0.5 * midZ(yF) * 0.8;
  }
  const fit = fitProfileAmplitude({
    midline,
    curve: { ext, skin, noseRow },
    noseY,
    chinY,
  });
  TestValidator.predicate(
    "alpha recovered through the clamped tail",
    nclose(fit.alpha, 0.5, 0.03),
  );
  TestValidator.predicate(
    "rowScale recovered",
    nclose(fit.rowScale, 0.8, 0.015),
  );
};
