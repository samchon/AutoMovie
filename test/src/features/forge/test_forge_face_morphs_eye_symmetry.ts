import { buildFaceMorphs } from "@autofilm/forge";
import { TestValidator } from "@nestia/e2e";

/**
 * Both eyes must respond equally to the eye morphs. The canonical face is
 * x-mirror-symmetric and the two eye centers sit close enough that the off-eye
 * gaussian is not negligible — a first-match-over-a-threshold center pick once
 * bound every left-eye vertex to the RIGHT eye's center, so only one eye
 * enlarged (the regression this test pins).
 *
 * Scenario: for `eyeSize` and `eyeWidth`, each left-eye landmark's delta
 * magnitude equals its mirrored right-eye landmark's within 1e-9 (33↔263 outer
 * corners, 159↔386 upper lids, 145↔374 lower lids).
 */
export const test_forge_face_morphs_eye_symmetry = (): void => {
  const morphs = buildFaceMorphs();
  const PAIRS: [number, number][] = [
    [33, 263],
    [159, 386],
    [145, 374],
  ];
  for (const name of ["eyeSize", "eyeWidth"] as const) {
    const d = morphs[name];
    const mag = (i: number): number =>
      Math.hypot(d[i * 3]!, d[i * 3 + 1]!, d[i * 3 + 2]!);
    for (const [r, l] of PAIRS) {
      TestValidator.predicate(
        `${name} moves both eyes (${r}↔${l})`,
        Math.abs(mag(r) - mag(l)) < 1e-9 && mag(l) > 1e-5,
      );
    }
  }
};
