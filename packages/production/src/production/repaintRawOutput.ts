import { AutoMovieContentDigest } from "@automovie/interface";

import {
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";

/**
 * Why provider output remained raw rather than becoming an active candidate.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Keeps rejected and interrupted output addressable without promoting it.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Separates raw retention state from candidate admission.
 */
export type AutoMovieRepaintRawOutputDisposition =
  | "candidate-source"
  | "invalid"
  | "partial"
  | "cancelled"
  | "budget-exhausted";

/**
 * Immutable attempt-owned provider output identity.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Preserves exact available bytes beside their terminal attempt.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Binds raw bytes to one request, attempt, disposition, and retention ceiling.
 */
export interface IAutoMovieRepaintRawOutputReceipt {
  /** Receipt schema version. */
  version: 1;
  /** Production namespace that owns the attempt. */
  productionId: string;
  /** Shot the attempt repainted. */
  shot: string;
  /** Request the attempt belongs to. */
  requestId: string;
  /** Attempt whose provider output these bytes are. */
  attemptId: string;
  /** Tracked project-relative path of the retained raw bytes. */
  path: string;
  /** Content digest of the retained raw bytes. */
  digest: AutoMovieContentDigest;
  /** Exact retained byte length. */
  bytes: number;
  /** Retention ceiling the raw output was admitted under. */
  maximumBytes: number;
  /** Media type the provider declared for the raw output. */
  mediaType: string;
  /** Terminal attempt disposition the raw output belongs to. */
  disposition: AutoMovieRepaintRawOutputDisposition;
  /** ISO-8601 UTC instant the raw output was retained. */
  retainedAt: string;
}

/**
 * Raw output plus the copied bytes that an atomic project transaction writes.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Keeps receipt and bytes in one publication unit.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Prevents a digest-only record from standing in for recoverable output.
 */
export interface IAutoMovieRepaintRawOutputPublication {
  /** Receipt describing the bytes published beside it. */
  receipt: IAutoMovieRepaintRawOutputReceipt;
  /** Exact raw bytes the receipt's digest covers. */
  bytes: Uint8Array;
}

/**
 * Canonical tracked receipt path for one attempt-owned raw revision.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Keeps the recoverable byte revision reachable from its terminal attempt.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Gives project persistence one unambiguous receipt owner.
 */
export const productionRepaintRawOutputReceiptPath = (
  requestId: string,
  attemptId: string,
): string =>
  [
    "renditions",
    "raw",
    encodeAutoMoviePathSegment(exactText(requestId, "request id")),
    encodeAutoMoviePathSegment(exactText(attemptId, "attempt id")),
    "receipt.json",
  ].join("/");

/**
 * Form the immutable raw-output publication for one terminal attempt.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Retains available provider bytes even when validation, cancellation, or the request budget prevents candidate admission.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Separates attempt-owned raw bytes from the validated candidate revision derived from them.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reproduction-boundary Preserves a provider's raw result and its conditions because a repaint cannot be re-verified by rerun.
 */
export const planAutoMovieRepaintRawOutput = (props: {
  productionId: string;
  shot: string;
  requestId: string;
  attemptId: string;
  bytes: Uint8Array;
  mediaType: string;
  disposition: AutoMovieRepaintRawOutputDisposition;
  retainedAt: string;
  maximumBytes: number;
}): IAutoMovieRepaintRawOutputPublication => {
  for (const [label, value] of [
    ["production id", props.productionId],
    ["shot", props.shot],
    ["request id", props.requestId],
    ["attempt id", props.attemptId],
    ["media type", props.mediaType],
  ] as const)
    exactText(value, label);
  if (!isDisposition(props.disposition))
    throw new Error("Repaint raw output disposition is malformed.");
  if (
    props.bytes instanceof Uint8Array === false ||
    props.bytes.length === 0 ||
    Number.isSafeInteger(props.maximumBytes) === false ||
    props.maximumBytes <= 0 ||
    props.bytes.length > props.maximumBytes
  )
    throw new Error(
      "Repaint raw output requires non-empty bytes within the declared retention ceiling.",
    );
  const retainedAt = exactInstant(props.retainedAt);
  const bytes = new Uint8Array(props.bytes);
  const digest = digestAutoMovieBytes(bytes);
  const path = [
    "renditions",
    "raw",
    encodeAutoMoviePathSegment(props.requestId),
    encodeAutoMoviePathSegment(props.attemptId),
    `${digest.slice("sha256:".length)}.bin`,
  ].join("/");
  return {
    receipt: {
      version: 1,
      productionId: props.productionId,
      shot: props.shot,
      requestId: props.requestId,
      attemptId: props.attemptId,
      path,
      digest,
      bytes: bytes.length,
      maximumBytes: props.maximumBytes,
      mediaType: props.mediaType,
      disposition: props.disposition,
      retainedAt,
    },
    bytes,
  };
};

/**
 * Verify bytes against the exact attempt-owned raw receipt before resumption.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retry-request-boundary Allows candidate publication to resume from the same succeeded attempt without another provider call.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Refuses a raw revision whose identity or bytes moved after the terminal attempt.
 */
export const assertAutoMovieRepaintRawOutput = (props: {
  receipt: IAutoMovieRepaintRawOutputReceipt;
  bytes: Uint8Array;
  requestId: string;
  attemptId: string;
}): void => {
  const receipt = props.receipt;
  if (
    receipt.version !== 1 ||
    receipt.requestId !== props.requestId ||
    receipt.attemptId !== props.attemptId ||
    props.bytes instanceof Uint8Array === false ||
    !isExactText(receipt.productionId) ||
    !isExactText(receipt.shot) ||
    !isExactText(receipt.requestId) ||
    !isExactText(receipt.attemptId) ||
    !isExactText(receipt.mediaType) ||
    !isExactText(receipt.path) ||
    !isExactInstant(receipt.retainedAt) ||
    !isDisposition(receipt.disposition) ||
    /^sha256:[0-9a-f]{64}$/u.test(receipt.digest) === false ||
    Number.isSafeInteger(receipt.maximumBytes) === false ||
    receipt.maximumBytes <= 0 ||
    receipt.bytes !== props.bytes.length ||
    receipt.bytes > receipt.maximumBytes ||
    receipt.digest !== digestAutoMovieBytes(props.bytes) ||
    receipt.path !==
      [
        "renditions",
        "raw",
        encodeAutoMoviePathSegment(receipt.requestId),
        encodeAutoMoviePathSegment(receipt.attemptId),
        `${receipt.digest.slice("sha256:".length)}.bin`,
      ].join("/")
  )
    throw new Error(
      "Repaint raw output does not match its immutable attempt-owned receipt.",
    );
};

const exactText = (value: string, label: string): string => {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value !== value.trim()
  )
    throw new Error(
      `Repaint raw output ${label} must be exact non-blank text.`,
    );
  return value;
};

const exactInstant = (value: string): string => {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime()) || instant.toISOString() !== value)
    throw new Error("Repaint raw output requires an exact UTC instant.");
  return value;
};

const isExactInstant = (value: string): boolean => {
  try {
    return exactInstant(value) === value;
  } catch {
    return false;
  }
};

const isExactText = (value: string): boolean => {
  try {
    return exactText(value, "field") === value;
  } catch {
    return false;
  }
};

const isDisposition = (value: AutoMovieRepaintRawOutputDisposition): boolean =>
  value === "candidate-source" ||
  value === "invalid" ||
  value === "partial" ||
  value === "cancelled" ||
  value === "budget-exhausted";
