import type { portraitDiagnosticsReview } from "./diagnostics-review";
import type { portraitNasalReview } from "./nasal-review";
import type { portraitOcularReview } from "./ocular-review";
import type { portraitOralReview } from "./oral-review";
import type { portraitStudyReview } from "./study-review";
import type { portraitSurfaceReview } from "./surface-review";

/**
 * Partial construction-source account. Individual notes retain the explicitly
 * named historical capture that was inspected; a historical observation is not
 * a current-source attestation. In particular, the b3306ba5 patch/fairing notes
 * predate late source insertion and XYZ tangent-row fairing and need a renewed
 * literal source review. Current image observations belong to review.md.
 * Relationships are recorded before compiler-issued fingerprints are inserted.
 * Missing coverage/fingerprints remain errors; this intermediate account does
 * not claim whole-source or likeness acceptance.
 *
 * @evidence {@link portraitOcularReview} Retains optical identity, lids, lashes, brows and orbital support inspections within the complete construction account.
 * @evidenceReview {@link portraitOcularReview} #cf39ef3 Compared the retained optical, orbital, lid, lash and brow pairs with the combined record. Fixed-canthal construction observations and the frozen study's unaccepted eye fitting remain distinct; their original source fingerprints are unchanged.
 * @evidence {@link portraitNasalReview} Retains external nasal body, aperture sections and shared nasal attachment inspections within the complete construction account.
 * @evidenceReview {@link portraitNasalReview} #3bf444b Compared the retained nasal body, jet, rim, cavity and attachment pairs with the combined record. Existing primitive and envelope limits remain recorded without accepting the rejected alternative or renewing its rendered basis.
 * @evidence {@link portraitOralReview} Retains lips, oral enclosure, tongue, teeth and mandibular performance inspections within the complete construction account.
 * @evidenceReview {@link portraitOralReview} #74e2f69 Compared the retained oral chamber, tongue, crown, lip and mandibular pairs with the combined record. Their separate enclosure, placement and performed-contact observations remain intact; this relocation does not accept the visible teeth or mouth.
 * @evidence {@link portraitSurfaceReview} Retains shared topology, skin, cranium, materials and model export inspections within the complete construction account.
 * @evidenceReview {@link portraitSurfaceReview} #588adce Compared the retained shared topology, skin, cranial, material and export pairs with the combined record. Mutation, unit conversion and construction-order observations keep their original source fingerprints and numerical limitations; the formatted carrier retains the same scope value.
 * @evidence {@link portraitStudyReview} Retains frozen measurements, recipes, fitted construction and attributed alternatives inspections within the complete construction account.
 * @evidenceReview {@link portraitStudyReview} #db90abe Compared every subject-owned measurement, recipe, fitted assembly and reference alternative pair with the combined record. The historical source identities, frozen fitting status and rejected nasal observation remain unchanged; no new person-specific fitting occurred.
 * @evidence {@link portraitDiagnosticsReview} Retains capture identities, fit bases and historical join diagnostics inspections within the complete construction account.
 * @evidenceReview {@link portraitDiagnosticsReview} #e486445 Compared the retained byte-identity, lease, fit-basis, patch and fairing pairs with the combined record. The b3306ba5 observations and their later-source caveat remain historical; the formatted carrier keeps its scope value without rerunning or endorsing that nasal alternative.
 */
export const portraitReview = {
  directory: ".shots/face-experiment/preview",
  sourceCommit: "ac1145b0",
  gltfSha256:
    "49c90e9d61b6e0ec3004630d86cace7eebe096ca7228466cb28f9b7ffb5198cb",
  profileSha256:
    "d682354f6c1be6500f66cd7783f27e0554aa8bfa5ea396daa49a334ea1588145",
};
