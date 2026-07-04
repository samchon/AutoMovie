import { fitProfileAmplitude } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * The amplitude fit recovers a synthetic ground truth: the profile curve is
 * manufactured FROM the midline at a known alpha and row scale, so the
 * grid-search + least-squares must find that pair with a near-zero residual
 * (the oracle is the construction, not the fit). The midline must be nonlinear
 * — under a straight line every row scale explains the curve equally and the
 * scale is unidentifiable, which is also why real noses and lips (kinked
 * curves) pin it.
 *
 * Scenario: a kinked midline (steep to y=130, near-flat after) over rows
 * 100..160, profile rows built at alpha 0.5 / rowScale 0.8 — the fit returns
 * alpha ≈ 0.5, rowScale ≈ 0.8, rms ≈ 0.
 */
export const test_forge_profile_amplitude = (): void => {
  const noseY = 100;
  const chinY = 160;
  const noseRow = 50;
  const alphaTrue = 0.5;
  const scTrue = 0.8;
  const midline = [
    { y: 100, z: 0 },
    { y: 130, z: -30 },
    { y: 160, z: -35 },
  ];
  const midZ = (y: number): number =>
    y <= 130 ? -(y - 100) : -30 - (5 * (y - 130)) / 30;

  const ext = new Array<number>(220).fill(-1);
  const skin = new Array<boolean>(220).fill(true);
  for (let yP = noseRow; yP < 220; yP++) {
    const yF = noseY + (yP - noseRow) / scTrue;
    ext[yP] = 240 + alphaTrue * midZ(yF) * scTrue;
  }
  const fit = fitProfileAmplitude({
    midline,
    curve: { ext, skin, noseRow },
    noseY,
    chinY,
  });
  TestValidator.predicate("alpha recovered", nclose(fit.alpha, 0.5, 0.02));
  TestValidator.predicate(
    "rowScale recovered",
    nclose(fit.rowScale, 0.8, 0.015),
  );
  TestValidator.predicate("near-zero residual", fit.rms < 0.5);
};
