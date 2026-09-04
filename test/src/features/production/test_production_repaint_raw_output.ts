import { AutoMovieContentDigest } from "@automovie/interface";
import {
  assertAutoMovieRepaintRawOutput,
  planAutoMovieRepaintRawOutput,
  productionRepaintRawOutputReceiptPath,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Raw repaint bytes remain an immutable attempt-owned recovery source.
 *
 * Scenarios:
 *
 * 1. Candidate, invalid, partial, cancelled and over-budget output all receive
 *    the same content-addressed raw receipt without sharing mutable bytes.
 * 2. Empty, oversized, changed or cross-attempt bytes are refused.
 */
export const test_production_repaint_raw_output = (): void => {
  const source = new Uint8Array([1, 2, 3, 4]);
  const publications = [
    "candidate-source",
    "invalid",
    "partial",
    "cancelled",
    "budget-exhausted",
  ].map((disposition) =>
    planAutoMovieRepaintRawOutput({
      productionId: "film",
      shot: "opening",
      requestId: "10000000-0000-4000-8000-000000000001",
      attemptId: "20000000-0000-4000-8000-000000000001",
      bytes: source,
      mediaType: "video/mp4",
      disposition: disposition as
        | "candidate-source"
        | "invalid"
        | "partial"
        | "cancelled"
        | "budget-exhausted",
      retainedAt: "2026-09-04T00:00:00.000Z",
      maximumBytes: 4,
    }),
  );
  source[0] = 9;
  for (const publication of publications)
    assertAutoMovieRepaintRawOutput({
      receipt: publication.receipt,
      bytes: publication.bytes,
      requestId: publication.receipt.requestId,
      attemptId: publication.receipt.attemptId,
    });
  TestValidator.equals(
    "every terminal disposition retains the same immutable copied raw bytes",
    publications.map(({ receipt, bytes }) => ({
      disposition: receipt.disposition,
      bytes: [...bytes],
      path: receipt.path,
      receiptPath: productionRepaintRawOutputReceiptPath(
        receipt.requestId,
        receipt.attemptId,
      ),
    })),
    publications.map(({ receipt }) => ({
      disposition: receipt.disposition,
      bytes: [1, 2, 3, 4],
      path: `renditions/raw/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/${receipt.digest.slice("sha256:".length)}.bin`,
      receiptPath:
        "renditions/raw/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/receipt.json",
    })),
  );
  const receipt = publications[0]!.receipt;
  TestValidator.equals(
    "empty, oversized, changed and cross-attempt output are refused",
    [
      throwsError(() =>
        planAutoMovieRepaintRawOutput({
          productionId: "film",
          shot: "opening",
          requestId: "request",
          attemptId: "attempt",
          bytes: new Uint8Array(),
          mediaType: "video/mp4",
          disposition: "invalid",
          retainedAt: "2026-09-04T00:00:00.000Z",
          maximumBytes: 4,
        }),
      ),
      throwsError(() =>
        planAutoMovieRepaintRawOutput({
          productionId: "film",
          shot: "opening",
          requestId: "request",
          attemptId: "attempt",
          bytes: new Uint8Array(5),
          mediaType: "video/mp4",
          disposition: "invalid",
          retainedAt: "2026-09-04T00:00:00.000Z",
          maximumBytes: 4,
        }),
      ),
      throwsError(() =>
        assertAutoMovieRepaintRawOutput({
          receipt,
          bytes: new Uint8Array([1, 2, 3, 5]),
          requestId: receipt.requestId,
          attemptId: receipt.attemptId,
        }),
      ),
      throwsError(() =>
        assertAutoMovieRepaintRawOutput({
          receipt,
          bytes: publications[0]!.bytes,
          requestId: receipt.requestId,
          attemptId: "different",
        }),
      ),
      /^sha256:[0-9a-f]{64}$/u.test(receipt.digest as AutoMovieContentDigest),
    ],
    [true, true, true, true, true],
  );
};
