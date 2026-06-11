import { buildFaceMorphs } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * Per-side eye targets must be exact mirrors AND independent. The canonical
 * face is x-mirror-symmetric, so each left-side target's delta magnitude at a
 * left landmark equals the right-side target's at the mirrored landmark — and a
 * side's target must leave the OTHER eye exactly untouched (overlapping
 * gaussians once bound the whole left eye to the right center; the nearest-
 * center gate pins both properties).
 *
 * Scenario: for eyeSize/eyeWidth/eyeTilt, mirrored pairs (33↔263, 159↔386,
 * 145↔374) match within 1e-9 across the R/L targets, and the R target is
 * exactly zero on the left landmarks.
 */
export const test_forge_face_morphs_eye_symmetry = (): void => {
  const morphs = buildFaceMorphs();
  const PAIRS: [number, number][] = [
    [33, 263],
    [159, 386],
    [145, 374],
  ];
  const mag = (d: number[], i: number): number =>
    Math.hypot(d[i * 3]!, d[i * 3 + 1]!, d[i * 3 + 2]!);
  for (const base of ["eyeSize", "eyeWidth", "eyeTilt"] as const) {
    const dR = morphs[`${base}R`];
    const dL = morphs[`${base}L`];
    for (const [r, l] of PAIRS) {
      TestValidator.predicate(
        `${base} mirrors (${r}↔${l})`,
        Math.abs(mag(dR, r) - mag(dL, l)) < 1e-9 && mag(dL, l) > 1e-5,
      );
      TestValidator.equals(
        `${base}R leaves the left eye untouched (${l})`,
        [dR[l * 3], dR[l * 3 + 1], dR[l * 3 + 2]],
        [0, 0, 0],
      );
    }
  }
};
