import { IAutoMovieDiagnostic } from "./IAutoMovieProductionCompiler";
import {
  AutoMovieContentDigest,
  IAutoMovieProductionDesign,
  IAutoMovieShotContract,
} from "./IAutoMovieProductionDesign";

/** One exact legacy path considered by a production import plan. */
export interface IAutoMovieLegacyImportInventoryEntry {
  /** Legacy-root-relative canonical POSIX path. */
  path: string;
  /** Exact bytes, or zero when a registered asset is absent. */
  bytes: number;
  /** Exact content digest, or null when a registered asset is absent. */
  digest: AutoMovieContentDigest | null;
  /** Why this file belongs to the import boundary. */
  kind: "project" | "asset";
}

/** One coding-agent source module that cannot be recovered from legacy data. */
export interface IAutoMovieLegacySourceTodo {
  /** Legacy shot whose performance authoring source was not persisted. */
  shot: string;
  /** Proposed production source module path. */
  module: string;
  /** Proposed named source export. */
  export: string;
  /** Exact recovery limitation and required next action. */
  reason: string;
}

/** Exact pre-import state of one production-owned directory. */
export interface IAutoMovieLegacyOwnedDirectoryBaseline {
  /** Production-owned project-relative directory. */
  path: "src" | "generated" | "renders";
  /** Whether the directory existed when the import plan was captured. */
  existed: boolean;
  /** Exact recursive file inventory at capture time. */
  files: IAutoMovieLegacyImportInventoryEntry[];
}

/**
 * Immutable, non-destructive interpretation of one resident legacy project.
 *
 * Drafts are evidence-backed starting points, not active production truth.
 * Applying the plan persists this document and provenance without inventing
 * source or claiming that the production compiler can already succeed.
 */
export interface IAutoMovieLegacyImportPlan {
  /** Import-plan format. */
  version: 1;
  /** Domain-separated identity of every field below except this fingerprint. */
  fingerprint: AutoMovieContentDigest;
  /** Legacy monotonic revision captured by this plan. */
  legacyRevision: number;
  /** Exact deterministic legacy byte inventory. */
  inventory: IAutoMovieLegacyImportInventoryEntry[];
  /** Trusted rollback fence for production-owned directories. */
  rollbackBaseline: IAutoMovieLegacyOwnedDirectoryBaseline[];
  /** Conservative production design draft with explicit default warnings. */
  productionDraft: IAutoMovieProductionDesign;
  /** Conservative shot contract drafts; their source modules remain TODOs. */
  shotContractDrafts: IAutoMovieShotContract[];
  /** Unrecoverable coding-agent source bindings. */
  sourceTodos: IAutoMovieLegacySourceTodo[];
  /** Import limitations and corrective actions. */
  diagnostics: IAutoMovieDiagnostic[];
}

/** Result of applying or re-applying one legacy import plan. */
export interface IAutoMovieLegacyImportApplyOutput {
  /** Whether state was created or the identical plan was already applied. */
  status: "applied" | "unchanged";
  /** Exact plan persisted by the import. */
  plan: IAutoMovieLegacyImportPlan;
}

/** Result of rolling back one untouched applied import. */
export interface IAutoMovieLegacyImportRollbackOutput {
  /** Rollback completion marker. */
  status: "rolled-back";
  /** Fingerprint of the removed import plan. */
  fingerprint: AutoMovieContentDigest;
}
