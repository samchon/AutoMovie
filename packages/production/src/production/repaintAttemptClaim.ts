import { AutoMovieContentDigest } from "@automovie/interface";

/**
 * Immutable request-prefix claim held before an external repaint side effect.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Identifies the one request prefix allowed to dispatch next.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Carries the atomic admission identity across the project store.
 */
export interface IAutoMovieRepaintAttemptClaim {
  /** Claim schema version. */
  version: 1;
  /** Production namespace the claimed request belongs to. */
  productionId: string;
  /** Shot whose repaint request this attempt extends. */
  shot: string;
  /** Stable identity of the request being attempted. */
  requestId: string;
  /** Digest of the exact request the claim was admitted against. */
  requestFingerprint: AutoMovieContentDigest;
  /** One-based position of this attempt within its request. */
  attemptOrdinal: number;
  /** Stable identity of the attempt the claim reserves. */
  attemptId: string;
  /** Digest of the attempt prefix that must still be current when the side effect settles. */
  prefixDigest: AutoMovieContentDigest;
  /** Project-store generation the claim was written under. */
  generation: number;
  /** ISO-8601 UTC instant the claim was admitted. */
  claimedAt: string;
}

/**
 * Atomic admission result returned by the project-owned claim store.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Distinguishes an acquired retry from a duplicate, moved prefix, or unknown predecessor.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Prevents non-acquired states from reaching provider dispatch.
 */
export type AutoMovieRepaintClaimAdmission =
  | { status: "acquired" }
  | { status: "already-active"; ownerAttemptId: string }
  | { status: "prefix-changed" }
  | { status: "unknown-outcome"; ownerAttemptId: string };

/**
 * Terminal claim state written after the adapter boundary settles.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Preserves whether external work settled or remains unknown.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Gates retry recovery on an explicit settlement fact.
 */
export type AutoMovieRepaintClaimSettlement =
  | "fulfilled"
  | "rejected"
  | "unknown-outcome";

/**
 * Refuse a malformed claim before it reaches a project-owned transaction.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Keeps every admission entry point on the same exact request-prefix identity.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Prevents a direct project caller from bypassing claim validation.
 */
export const assertAutoMovieRepaintAttemptClaim = (
  claim: IAutoMovieRepaintAttemptClaim,
): void => {
  validatedClaim(claim);
};

const validatedClaim = (
  claim: IAutoMovieRepaintAttemptClaim,
): IAutoMovieRepaintAttemptClaim => {
  if (
    claim.version !== 1 ||
    [claim.productionId, claim.shot, claim.requestId, claim.attemptId].some(
      (value) =>
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value !== value.trim(),
    ) ||
    /^sha256:[0-9a-f]{64}$/u.test(claim.requestFingerprint) === false ||
    /^sha256:[0-9a-f]{64}$/u.test(claim.prefixDigest) === false ||
    Number.isSafeInteger(claim.attemptOrdinal) === false ||
    claim.attemptOrdinal <= 0 ||
    Number.isSafeInteger(claim.generation) === false ||
    claim.generation <= 0
  )
    throw new Error("Repaint attempt claim identity is malformed.");
  const claimedAt = new Date(claim.claimedAt);
  if (
    Number.isNaN(claimedAt.getTime()) ||
    claimedAt.toISOString() !== claim.claimedAt
  )
    throw new Error("Repaint attempt claim requires an exact UTC instant.");
  return structuredClone(claim);
};
