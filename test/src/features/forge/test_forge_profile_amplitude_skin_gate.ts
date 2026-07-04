import { fitProfileAmplitude } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * Rows whose silhouette edge is not skin (bangs, loose strands) and rows with
 * no figure at all must not participate: poisoning them with garbage extents
 * may not move the fitted amplitude.
 *
 * Scenario: the synthetic curve of the recovery case, with every third row
 * marked non-skin and set to a wild extent and one row's figure removed (ext
 * -1) ??alpha still comes out ??0.5.
 */
export const test_forge_profile_amplitude_skin_gate = (): void => {
  const noseY = 100;
  const chinY = 160;
  const noseRow = 50;
  const midline = [
    { y: noseY, z: 0 },
    { y: chinY, z: -(chinY - noseY) },
  ];
  const ext = new Array<number>(200).fill(-1);
  const skin = new Array<boolean>(200).fill(true);
  for (let yP = noseRow; yP < 200; yP++) {
    const yF = noseY + (yP - noseRow) / 0.8;
    ext[yP] = 240 + 0.5 * -(yF - noseY) * 0.8;
  }
  for (let yP = noseRow + 3; yP < 200; yP += 3) {
    skin[yP] = false;
    ext[yP] = 999; // garbage that would wreck an ungated fit
  }
  ext[noseRow + 7] = -1; // a dropout row
  const fit = fitProfileAmplitude({
    midline,
    curve: { ext, skin, noseRow },
    noseY,
    chinY,
  });
  TestValidator.predicate(
    "gated alpha unaffected",
    nclose(fit.alpha, 0.5, 0.02),
  );
};
