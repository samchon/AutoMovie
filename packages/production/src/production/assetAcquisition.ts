import { validateGeneratedAcquisition } from "@automovie/engine";
import { IAutoMovieAssetProvenance } from "@automovie/interface";

import { autoMovieExternalLocatorRefusal } from "./contentIdentity";

/** A plain SHA-256 content digest as this project writes it. */
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

type AssetUrlAdmissionRefusal = {
  field: "original" | "license";
  reason: "malformed" | "unsupported-protocol" | "credential-bearing";
};

/** Why one locator is not a credential-free HTTP(S) URL. */
const httpUrlAdmissionRefusal = (
  value: string,
): AssetUrlAdmissionRefusal["reason"] | null => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "malformed";
  }
  if (["http:", "https:"].includes(parsed.protocol) === false)
    return "unsupported-protocol";
  return autoMovieExternalLocatorRefusal(value) === "credential-bearing"
    ? "credential-bearing"
    : null;
};

/**
 * Refuse a fetched source or license locator before the asset is adopted.
 *
 * The result names only the field and failure class. It never carries the
 * rejected locator, so a caller can diagnose the correction without copying
 * embedded credentials into a diagnostic, receipt, or generated artifact.
 *
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-credential-separation Keeps credential-bearing locators out of admitted source and license provenance.
 * @evidence requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-credential-omission Returns a failure class without retaining the rejected secret-bearing locator.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-secret-reference-boundary Implements the credential-free URI boundary for provenance ledgers.
 * @evidence specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md#evp-credential-exclusion-gate Gives ingestion callers a redacted credential exclusion decision before publication.
 */
export const assetUrlAdmissionRefusal = (
  asset: IAutoMovieAssetProvenance,
): AssetUrlAdmissionRefusal | null => {
  if (asset.original !== undefined) {
    const reason = httpUrlAdmissionRefusal(asset.original.url);
    if (reason !== null) return { field: "original", reason };
  }
  const reason = httpUrlAdmissionRefusal(asset.license.url);
  return reason === null ? null : { field: "license", reason };
};

/**
 * Whether one asset fails to say where its bytes came from.
 *
 * ## Why acquisition is two shapes rather than one
 *
 * The ledger was written when every asset had been fetched from somewhere, so
 * it demanded a live source URL and the digest served at that URL. An image a
 * model produced has neither. Satisfying the old shape would have meant writing
 * a URL nothing serves, and a manifest whose provenance is invented is worse
 * than one that admits the asset is generated — a later reader cannot tell the
 * two apart, so every URL in the ledger becomes untrustworthy at once.
 *
 * So an asset carries exactly one of `original` (something served these bytes,
 * at this URL, with this digest) and `generated` (this provider and model
 * returned these bytes for this instruction). Carrying both is a contradiction
 * and carrying neither is an omission; this predicate reports both, along with
 * an incomplete instance of whichever one is present.
 *
 * Backward compatibility falls out of the shape: every manifest written before
 * generated assets existed carries `original`, so it reads unchanged and is
 * held to exactly the rules it was written against.
 *
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-credential-separation Refuses fetched acquisition records whose locator embeds credentials.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-secret-reference-boundary Applies the provenance ledger's credential-free locator rule while preserving generated acquisitions.
 */
export const assetAcquisitionIncomplete = (
  asset: IAutoMovieAssetProvenance,
): boolean => {
  const acquired = asset.original;
  const generated = asset.generated;
  if ((acquired === undefined) === (generated === undefined)) return true;
  if (acquired !== undefined)
    return (
      DIGEST_PATTERN.test(acquired.digest) === false ||
      httpUrlAdmissionRefusal(acquired.url) !== null
    );
  return (
    validateGeneratedAcquisition({
      acquisition: generated!,
      // Once a local transformation has run, the current bytes are no longer
      // the generator's own output, so comparing the two digests would report
      // every legitimately processed asset as drifted.
      digest: asset.processing.length === 0 ? asset.digest : null,
    }).success === false
  );
};

/**
 * Whether an asset's current bytes differ from what it acquired while recording
 * no transformation that would explain the difference.
 *
 * The question is the same for both acquisition shapes — bytes changed and
 * nobody said how — but the baseline differs: a fetched asset is compared
 * against the digest its source served, a generated one against the digest its
 * generator returned. An asset with neither acquisition is silent here rather
 * than doubly reported; {@link assetAcquisitionIncomplete} already owns it.
 */
export const assetProcessingOmitted = (
  asset: IAutoMovieAssetProvenance,
): boolean => {
  if (asset.processing.length > 0) return false;
  if (asset.original !== undefined)
    return asset.digest !== asset.original.digest;
  if (asset.generated !== undefined)
    return asset.digest !== asset.generated.outputDigest;
  return false;
};
