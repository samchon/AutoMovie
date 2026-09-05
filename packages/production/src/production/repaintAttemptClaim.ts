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
 * Result of one request-scoped claimed dispatch.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Returns completion only for the attempt that acquired the exact request prefix.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Retains duplicate and reconciliation refusals as typed outcomes.
 */
export type AutoMovieRepaintClaimedDispatch<T> =
  | { status: "completed"; value: T }
  | Exclude<AutoMovieRepaintClaimAdmission, { status: "acquired" }>;

/**
 * Error identifying a timed-out adapter whose external outcome is unknown.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-budget-stop Prevents an ignored cancellation from being treated as a completed timeout.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Requires reconciliation rather than automatic retry after an unknown outcome.
 */
export class AutoMovieRepaintUnknownOutcomeError extends Error {}

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

/**
 * Reserve one exact next attempt before invoking an external repaint adapter.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Prevents concurrent retries from dispatching the same immutable request prefix twice.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Binds atomic admission to the request fingerprint, journal prefix, next ordinal, attempt identity, and claim generation.
 */
export const executeClaimedAutoMovieRepaintAttempt = async <T>(props: {
  claim: IAutoMovieRepaintAttemptClaim;
  acquire: (
    claim: IAutoMovieRepaintAttemptClaim,
  ) =>
    | AutoMovieRepaintClaimAdmission
    | PromiseLike<AutoMovieRepaintClaimAdmission>;
  execute: () => Promise<T>;
  settle: (
    claim: IAutoMovieRepaintAttemptClaim,
    settlement: AutoMovieRepaintClaimSettlement,
  ) => unknown;
}): Promise<AutoMovieRepaintClaimedDispatch<T>> => {
  const claim = validatedClaim(props.claim);
  const admission = await props.acquire(structuredClone(claim));
  if (admission.status !== "acquired") return structuredClone(admission);
  let value: T;
  try {
    value = await props.execute();
  } catch (error) {
    if (safeUnknownOutcome(error)) {
      await props.settle(structuredClone(claim), "unknown-outcome");
      return { status: "unknown-outcome", ownerAttemptId: claim.attemptId };
    }
    await props.settle(structuredClone(claim), "rejected");
    throw error;
  }
  await props.settle(structuredClone(claim), "fulfilled");
  return { status: "completed", value };
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

const safeUnknownOutcome = (error: unknown): boolean => {
  try {
    return error instanceof AutoMovieRepaintUnknownOutcomeError;
  } catch {
    return false;
  }
};
