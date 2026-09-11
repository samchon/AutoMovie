import type { IAutoMovieAssetProvenance } from "@automovie/interface";

import { autoMovieExternalLocatorRefusal } from "./contentIdentity";

/**
 * Locate embedded credentials in descriptive asset metadata.
 *
 * The returned field and failure class keep the secret out of diagnostics.
 *
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-credential-separation Detects credential-bearing locators before asset metadata reaches stored output.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-secret-reference-boundary Returns the metadata field carrying a credential without copying the rejected value.
 * @evidence requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-credential-omission Keeps rejected credential values out of the diagnostic result.
 * @evidence requirements/sound/sources-and-external-assets.md#sound-source-secret-remote-boundary Rejects embedded credentials in optional metadata for registered audio assets.
 * @evidence specifications/simulation-effects-and-sound/sound-sources-events-dialogue-and-foley.md#sound-source-choice-provider-and-secret-boundary Returns a redacted credential failure for registered audio metadata before source adoption.
 * @evidence specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md#evp-credential-exclusion-gate Gives metadata readers a redacted credential exclusion result.
 * @author Samchon
 */
export const assetUrlAdmissionRefusal = (
  asset: IAutoMovieAssetProvenance,
): {
  field: "original" | "license";
  reason: "credential-bearing";
} | null => {
  for (const field of ["original", "license"] as const) {
    const locator = asset[field]?.url;
    if (
      locator !== undefined &&
      autoMovieExternalLocatorRefusal(locator) === "credential-bearing"
    )
      return { field, reason: "credential-bearing" };
  }
  return null;
};
