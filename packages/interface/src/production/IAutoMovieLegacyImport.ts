import { IAutoMovieDiagnostic } from "./IAutoMovieProductionCompiler";
import {
  AutoMovieContentDigest,
  IAutoMovieProductionDesign,
  IAutoMovieShotContract,
} from "./IAutoMovieProductionDesign";

/**
 * One exact legacy path considered by a production import plan.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `IAutoMovieLegacyImportInventoryEntry` as the portable data boundary for the operations resume compatibility classification requirement.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `IAutoMovieLegacyImportInventoryEntry` for the execution resume compatibility system contract.
 */
export interface IAutoMovieLegacyImportInventoryEntry {
  /**
   * Legacy-root-relative canonical POSIX path.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `path` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `path` for the execution resume compatibility system contract.
   */
  path: string;
  /**
   * Exact bytes, or zero when a registered asset is absent.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `bytes` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `bytes` for the execution resume compatibility system contract.
   */
  bytes: number;
  /**
   * Exact content digest, or null when a registered asset is absent.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `digest` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `digest` for the execution resume compatibility system contract.
   */
  digest: AutoMovieContentDigest | null;
  /**
   * Why this file belongs to the import boundary.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `kind` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `kind` for the execution resume compatibility system contract.
   */
  kind: "project" | "asset";
}

/**
 * One coding-agent source module that cannot be recovered from legacy data.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `IAutoMovieLegacySourceTodo` as the portable data boundary for the operations resume compatibility classification requirement.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `IAutoMovieLegacySourceTodo` for the execution resume compatibility system contract.
 */
export interface IAutoMovieLegacySourceTodo {
  /**
   * Legacy shot whose performance authoring source was not persisted.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `shot` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `shot` for the execution resume compatibility system contract.
   */
  shot: string;
  /**
   * Proposed production source module path.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `module` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `module` for the execution resume compatibility system contract.
   */
  module: string;
  /**
   * Proposed named source export.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `export` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `export` for the execution resume compatibility system contract.
   */
  export: string;
  /**
   * Exact recovery limitation and required next action.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `reason` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `reason` for the execution resume compatibility system contract.
   */
  reason: string;
}

/**
 * Exact pre-import state of one production-owned directory.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `IAutoMovieLegacyOwnedDirectoryBaseline` as the portable data boundary for the operations resume compatibility classification requirement.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `IAutoMovieLegacyOwnedDirectoryBaseline` for the execution resume compatibility system contract.
 */
export interface IAutoMovieLegacyOwnedDirectoryBaseline {
  /**
   * Production-owned project-relative directory.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `path` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `path` for the execution resume compatibility system contract.
   */
  path: "src" | "generated" | "renders";
  /**
   * Whether the directory existed when the import plan was captured.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `existed` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `existed` for the execution resume compatibility system contract.
   */
  existed: boolean;
  /**
   * Exact recursive physical subdirectory inventory at capture time.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `directories` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `directories` for the execution resume compatibility system contract.
   */
  directories: string[];
  /**
   * Exact recursive file inventory at capture time.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `files` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `files` for the execution resume compatibility system contract.
   */
  files: IAutoMovieLegacyImportInventoryEntry[];
}

/**
 * Immutable, non-destructive interpretation of one resident legacy project.
 *
 * Drafts are evidence-backed starting points, not active production truth.
 * Applying the plan persists this document and provenance without inventing
 * source or claiming that the production compiler can already succeed.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `IAutoMovieLegacyImportPlan` as the portable data boundary for the operations resume compatibility classification requirement.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `IAutoMovieLegacyImportPlan` for the execution resume compatibility system contract.
 */
export interface IAutoMovieLegacyImportPlan {
  /**
   * Import-plan format.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `version` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `version` for the execution resume compatibility system contract.
   */
  version: 1;
  /**
   * Domain-separated identity of every field below except this fingerprint.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `fingerprint` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `fingerprint` for the execution resume compatibility system contract.
   */
  fingerprint: AutoMovieContentDigest;
  /**
   * Legacy monotonic revision captured by this plan.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `legacyRevision` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `legacyRevision` for the execution resume compatibility system contract.
   */
  legacyRevision: number;
  /**
   * Exact deterministic legacy byte inventory.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `inventory` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `inventory` for the execution resume compatibility system contract.
   */
  inventory: IAutoMovieLegacyImportInventoryEntry[];
  /**
   * Trusted rollback fence for production-owned directories.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `rollbackBaseline` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `rollbackBaseline` for the execution resume compatibility system contract.
   */
  rollbackBaseline: IAutoMovieLegacyOwnedDirectoryBaseline[];
  /**
   * Conservative production design draft with explicit default warnings.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `productionDraft` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `productionDraft` for the execution resume compatibility system contract.
   */
  productionDraft: IAutoMovieProductionDesign;
  /**
   * Conservative shot contract drafts; their source modules remain TODOs.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `shotContractDrafts` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `shotContractDrafts` for the execution resume compatibility system contract.
   */
  shotContractDrafts: IAutoMovieShotContract[];
  /**
   * Unrecoverable coding-agent source bindings.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `sourceTodos` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `sourceTodos` for the execution resume compatibility system contract.
   */
  sourceTodos: IAutoMovieLegacySourceTodo[];
  /**
   * Import limitations and corrective actions.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Exposes `diagnostics` as the portable data boundary for the operations resume compatibility classification requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Types `diagnostics` for the execution resume compatibility system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

/**
 * Result of applying or re-applying one legacy import plan.
 *
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Exposes `IAutoMovieLegacyImportApplyOutput` as the portable data boundary for the external conversion receipt canonical result requirement.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Types `IAutoMovieLegacyImportApplyOutput` for the interchange canonical receipt result system contract.
 */
export interface IAutoMovieLegacyImportApplyOutput {
  /**
   * Whether state was created or the identical plan was already applied.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Exposes `status` as the portable data boundary for the external conversion receipt canonical result requirement.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Types `status` for the interchange canonical receipt result system contract.
   */
  status: "applied" | "unchanged";
  /**
   * Exact plan persisted by the import.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Exposes `plan` as the portable data boundary for the external conversion receipt canonical result requirement.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Types `plan` for the interchange canonical receipt result system contract.
   */
  plan: IAutoMovieLegacyImportPlan;
}

/**
 * Result of rolling back one untouched applied import.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-downgrade-rollback-compatibility Exposes `IAutoMovieLegacyImportRollbackOutput` as the portable data boundary for the operations downgrade rollback compatibility requirement.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-downgrade-rollback-compatibility Types `IAutoMovieLegacyImportRollbackOutput` for the execution downgrade rollback compatibility system contract.
 */
export interface IAutoMovieLegacyImportRollbackOutput {
  /**
   * Rollback completion marker.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-downgrade-rollback-compatibility Exposes `status` as the portable data boundary for the operations downgrade rollback compatibility requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-downgrade-rollback-compatibility Types `status` for the execution downgrade rollback compatibility system contract.
   */
  status: "rolled-back";
  /**
   * Fingerprint of the removed import plan.
   *
   * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-downgrade-rollback-compatibility Exposes `fingerprint` as the portable data boundary for the operations downgrade rollback compatibility requirement.
   * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-downgrade-rollback-compatibility Types `fingerprint` for the execution downgrade rollback compatibility system contract.
   */
  fingerprint: AutoMovieContentDigest;
}
