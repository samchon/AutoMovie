import { portraitCaptureDigest } from "./portraitCaptureDiagnostic";

/**
 * Admit a recorded fit only against the exact model and target bytes that its
 * producer consumed. These are artifact identities, not implementation-source
 * snapshots. Changing either geometric basis requires deriving a new fit rather
 * than copying a new digest onto coefficients from another construction.
 */
export function assertPortraitFitBasis(
  basis: { sourceModelSha256: string; targetControlNetSha256: string },
  sourceModel: Uint8Array,
  targetControlNet: Uint8Array,
): void {
  if (portraitCaptureDigest(sourceModel) !== basis.sourceModelSha256)
    throw new Error(
      "The recorded portrait fit has a different source model basis.",
    );
  if (portraitCaptureDigest(targetControlNet) !== basis.targetControlNetSha256)
    throw new Error(
      "The recorded portrait fit has a different target control basis.",
    );
}
