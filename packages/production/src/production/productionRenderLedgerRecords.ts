import type {
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderReceipt,
} from "@automovie/interface";
import typia, { type IValidation } from "typia";

import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";

/** The two persisted records that together prove one render publication. */
export type AutoMovieProductionRenderLedgerRecord =
  | "render-manifest"
  | "render-manifest-receipt";

/**
 * A render ledger record that materialized as JSON but is not its schema.
 *
 * The violations name schema paths and expected shapes only; the offending
 * values never travel into the diagnostic, so a hostile or credential-bearing
 * record cannot echo itself through a refusal.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation Refuses a persisted manifest or receipt that no longer satisfies its versioned contract instead of reading it as current evidence.
 * @evidence specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md#spec-delivery-provenance-integrity Names the schema position that broke provenance integrity without copying the stored value.
 */
export class AutoMovieProductionRenderLedgerSchemaError extends Error {
  /** Stable machine-readable diagnostic code. */
  public readonly code = "automovie-render-ledger-schema-invalid" as const;

  public constructor(
    /** Ledger record being admitted. */
    public readonly record: AutoMovieProductionRenderLedgerRecord,
    /** Schema path and expected shape of every violation, in report order. */
    public readonly violations: readonly string[],
  ) {
    super(
      `AutoMovie render ledger record "${record}" does not satisfy its schema: ${violations.join("; ")}.`,
    );
    this.name = "AutoMovieProductionRenderLedgerSchemaError";
  }
}

/**
 * Admit an already materialized value as the aggregate render manifest.
 *
 * Generated-project scripts and the compiler share this one admission so the
 * manifest schema is owned by the production package rather than re-derived
 * by every reader.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation Accepts only the exact current manifest contract so a stale or edited record cannot pass as the active publication.
 * @evidence specifications/execution-and-recovery/artifacts-and-atomic-publication.md#execution-atomic-current-commit Reopens the committed manifest as the same typed record the atomic commit wrote.
 */
export const assertProductionRenderManifestRecord = (
  value: unknown,
): IAutoMovieProductionRenderManifest =>
  admit(
    "render-manifest",
    typia.validateEquals<IAutoMovieProductionRenderManifest>(value),
  );

/**
 * Admit an already materialized value as the renderer-owned receipt.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation Accepts only the plan-bound receipt contract so an edited or historical receipt cannot vouch for current bytes.
 * @evidence specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md#spec-delivery-provenance-integrity Parses the receipt independently of the manifest it will be joined to.
 */
export const assertProductionRenderReceiptRecord = (
  value: unknown,
): IAutoMovieProductionRenderReceipt =>
  admit(
    "render-manifest-receipt",
    typia.validateEquals<IAutoMovieProductionRenderReceipt>(value),
  );

/**
 * Admit persisted render manifest bytes through strict structured JSON
 * ingress and then the manifest schema.
 *
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-text-metadata Reads the persisted manifest as a strict UTF-8, duplicate-free data tree before any schema judgement.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-text-metadata-inspection Routes manifest bytes through the one structured JSON admission instead of a permissive parser.
 */
export const parseProductionRenderManifestBytes = (
  bytes: Uint8Array,
): IAutoMovieProductionRenderManifest =>
  assertProductionRenderManifestRecord(
    parseAutoMovieStructuredJson({ record: "render-manifest", bytes }),
  );

/**
 * Admit persisted renderer receipt bytes through strict structured JSON
 * ingress and then the receipt schema.
 *
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-text-metadata Reads the persisted receipt as a strict UTF-8, duplicate-free data tree before any schema judgement.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-text-metadata-inspection Routes receipt bytes through the one structured JSON admission instead of a permissive parser.
 */
export const parseProductionRenderReceiptBytes = (
  bytes: Uint8Array,
): IAutoMovieProductionRenderReceipt =>
  assertProductionRenderReceiptRecord(
    parseAutoMovieStructuredJson({ record: "render-manifest-receipt", bytes }),
  );

const admit = <T>(
  record: AutoMovieProductionRenderLedgerRecord,
  validation: IValidation<T>,
): T => {
  if (validation.success === false)
    throw new AutoMovieProductionRenderLedgerSchemaError(
      record,
      validation.errors.map(
        (error) => `${error.path} expects ${error.expected}`,
      ),
    );
  return validation.data;
};
