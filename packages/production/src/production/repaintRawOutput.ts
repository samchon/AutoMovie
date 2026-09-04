import { AutoMovieContentDigest } from "@automovie/interface";

import {
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";

/** Why provider output remained raw rather than becoming an active candidate. */
export type AutoMovieRepaintRawOutputDisposition =
  | "candidate-source"
  | "invalid"
  | "partial"
  | "cancelled"
  | "budget-exhausted";

/** Immutable attempt-owned provider output identity. */
export interface IAutoMovieRepaintRawOutputReceipt {
  version: 1;
  productionId: string;
  shot: string;
  requestId: string;
  attemptId: string;
  path: string;
  digest: AutoMovieContentDigest;
  bytes: number;
  mediaType: string;
  disposition: AutoMovieRepaintRawOutputDisposition;
  retainedAt: string;
}

/** Raw output plus the copied bytes that an atomic project transaction writes. */
export interface IAutoMovieRepaintRawOutputPublication {
  receipt: IAutoMovieRepaintRawOutputReceipt;
  bytes: Uint8Array;
}

/**
 * Form the immutable raw-output publication for one terminal attempt.
 *
 * @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-attempt-failure-provenance Retains available provider bytes even when validation, cancellation, or the request budget prevents candidate admission.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-attempt-selection Separates attempt-owned raw bytes from the validated candidate revision derived from them.
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
    receipt.bytes !== props.bytes.length ||
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
