import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieContentDigest,
  IAutoMovieAcceptanceScenario,
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieEnvironmentContext,
  IAutoMovieFilmTimeline,
  IAutoMovieFormationDesign,
  IAutoMovieGeneratedManifest,
  IAutoMovieMaterializedLibrary,
  IAutoMovieModel,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDesign,
  IAutoMovieProductionRegistryManifest,
  IAutoMovieShotContract,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  IAutoMovieProductionDesignGraph,
  digestAutoMovieBytes,
  inspectAutoMovieLibraryProjectState,
} from "@automovie/production";
import path from "node:path";
import typia from "typia";

/**
 * Input for loading one active production from an initialized project.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Keeps the selected project and production as explicit input facts.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Carries the exact input revision boundary into diagnostic inspection.
 * @author Samchon
 */
export interface IAutoMovieProjectStateInput {
  /**
   * Project root containing the tracked `automovie` state directory.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Identifies the exact project whose state is inspected.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Makes the inspected source boundary explicit.
   */
  root: string;
  /**
   * Registered production id, or the project default when omitted.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Identifies the production scope attached to every finding.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Preserves the selected production revision boundary.
   */
  productionId?: string;
  /** Graph-derived kind and owner identity used by shape-aware currentness. */
  authoringEvidence?: IAutoMovieProductionEvidence;
  /** Fresh graph reader used by library atomic-currentness confirmation. */
  currentAuthoringEvidence?: () => IAutoMovieProductionEvidence;
}

/**
 * One reason loaded compiler-owned state cannot be treated as current.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Separates a loader result finding from the project input facts.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Classifies the exact derived-state failure boundary.
 * @author Samchon
 */
export interface IAutoMovieProjectStateProblem {
  /**
   * Stable machine-readable failure class.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-classification-independence Keeps failure classification separate from its prose and path.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-classification-orthogonality Preserves an independent machine-readable result class.
   */
  code:
    | "compile-status-unavailable"
    | "authoring-evidence-required"
    | "authoring-evidence-invalid"
    | "current-compile-invalid"
    | "generated-manifest-invalid"
    | "generated-file-duplicate"
    | "generated-file-missing"
    | "generated-file-unreadable"
    | "generated-file-modified"
    | "generated-json-invalid"
    | "generated-id-duplicate"
    | "generated-registry-mismatch"
    | "compile-fingerprint-stale"
    | "generated-state-incomplete"
    | "generated-shape-mismatch"
    | "library-index-invalid"
    | "library-owner-mismatch"
    | "project-state-changed";
  /**
   * Generated-root-relative path when one file caused the problem.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Locates the derived artifact that produced the finding.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Identifies the failed result boundary without rewriting input facts.
   */
  path: string | null;
  /**
   * Human-readable evidence and correction direction.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Reports observed evidence and a correction for the derived failure.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Explains which result stage failed and how to correct it.
   */
  message: string;
}

/**
 * Compiler identity and freshness attached to one loaded state snapshot.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Computes current state from source, dependency, and compiler identities.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Exposes the dependency-based freshness decision with its evidence.
 * @author Samchon
 */
export interface IAutoMovieProjectStateFreshness {
  /**
   * `current` is safe to query, `stale` preserves last generated evidence but
   * requires a compile, and `missing` means no generated manifest exists.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Distinguishes current generated evidence from stale or absent dependencies.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Reports whether the dependencies required for a current query match.
   */
  status: "current" | "stale" | "missing";
  /**
   * Fingerprint of the loaded compiler-owned output, or null when absent.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Records the identity of the generated side of the freshness comparison.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Supplies the observed output dependency identity.
   */
  compileFingerprint: AutoMovieContentDigest | null;
  /**
   * Fingerprint recomputed from current design, source, and declared content.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reapproval-after-change Recomputes authority after source or dependency replacement.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-reapproval-after-change Provides the new identity required for reapproval.
   */
  currentFingerprint: AutoMovieContentDigest | null;
  /**
   * Current read-only source-lint diagnostics.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Preserves current source findings separately from generated-state problems.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Reports findings against the exact current source revision.
   */
  diagnostics: readonly IAutoMovieDiagnostic[];
  /**
   * Reader-level integrity and race evidence.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Preserves loader and artifact findings independently of source diagnostics.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Classifies failures introduced while deriving the state snapshot.
   */
  problems: readonly IAutoMovieProjectStateProblem[];
}

/**
 * Compiler-owned artifacts loaded and typed from digest-verified JSON bytes.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-partial-results-and-aggregation Keeps incomplete generated evidence visible instead of promoting it to current.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-partial-aggregation Exposes every available generated component without overstating completeness.
 * @author Samchon
 */
export interface IAutoMovieGeneratedProjectState {
  /** Production shape selected from graph evidence, or legacy film fallback. */
  kind: "brief" | "film" | "library";
  /**
   * Ownership manifest that authenticated the loaded files.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Supplies the declared component and digest closure required for current use.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Carries the inventory consumed by the fail-closed gate.
   */
  manifest: IAutoMovieGeneratedManifest | null;
  /** Strict compiler-owned library index for the library arm. */
  library: IAutoMovieMaterializedLibrary | null;
  /** Digest-verified library environments keyed by id. */
  libraryEnvironments: ReadonlyMap<string, IAutoMovieBuiltEnvironment>;
  /** Digest-verified library contexts keyed by id. */
  libraryContexts: ReadonlyMap<string, IAutoMovieEnvironmentContext>;
  /**
   * Compiler registry of runtime assets, shots, and film.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-partial-results-and-aggregation Preserves the registry independently when other generated components fail.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-partial-aggregation Retains the exact generated coverage available to the caller.
   */
  registry: IAutoMovieProductionRegistryManifest | null;
  /**
   * Design contracts copied into the generated snapshot at compile time.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reproduction-boundary Separates compiled design evidence from the current editable design.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-reproduction-verification-boundary Preserves the exact compiled inputs available for deterministic reinspection.
   */
  design: IAutoMovieProductionDesignGraph;
  /**
   * Compiler-materialized runtime models keyed by recipe id.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-partial-results-and-aggregation Retains each verified model even when the overall snapshot is stale.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-partial-aggregation Preserves component coverage without claiming total completeness.
   */
  models: ReadonlyMap<string, IAutoMovieModel>;
  /**
   * Compiler-materialized shots keyed by shot id.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-partial-results-and-aggregation Retains each verified shot while reporting missing siblings separately.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-partial-aggregation Carries exact per-shot coverage into the aggregate result.
   */
  shots: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  /**
   * Compiler-materialized film timeline, when the compile produced one.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-partial-results-and-aggregation Represents an absent film independently from verified model and shot evidence.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-partial-aggregation Preserves the film component's exact availability in the aggregate.
   */
  film: IAutoMovieFilmTimeline | null;
}

/**
 * One transport-free, read-only project-state snapshot for ordinary scripts.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-partial-results-and-aggregation Returns observed current and generated evidence without concealing gaps.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-partial-aggregation Keeps the available component set observable.
 * @author Samchon
 */
export interface IAutoMovieProjectState {
  /**
   * Absolute physical project root selected by the reader.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Identifies the exact input scope of every returned finding.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Binds findings to the selected project root.
   */
  root: string;
  /**
   * Exact active production namespace.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Preserves the production input selected for inspection.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Binds the result to one explicit production scope.
   */
  productionId: string;
  /**
   * Project revision observed at the beginning of the read.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Supplies the source revision used by the current-state decision.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Binds freshness to the observed project revision.
   */
  revision: number;
  /**
   * Freshness and byte-integrity gate for the generated state.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Exposes the dependency and integrity decision before consumption.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Carries the computed freshness result and its evidence.
   */
  freshness: IAutoMovieProjectStateFreshness;
  /**
   * Current tracked design, which may be newer than generated state.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reapproval-after-change Keeps replacement source visible before generated results are reapproved.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-reapproval-after-change Exposes the changed source independently from the prior output.
   */
  design: IAutoMovieProductionDesignGraph;
  /**
   * Last compiler-owned state, loaded independently from current design.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reproduction-boundary Preserves prior deterministic output separately from current editable input.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-reproduction-verification-boundary Keeps reproducible generated evidence available for verification without granting it current status.
   */
  generated: IAutoMovieGeneratedProjectState;
}

/**
 * Generated state whose ownership, registry, and required contracts are
 * current.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Narrows only after all required generated evidence is current.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Exposes a non-null state only after the fail-closed gate passes.
 * @author Samchon
 */
export interface IAutoMovieCurrentTimedGeneratedProjectState extends IAutoMovieGeneratedProjectState {
  kind: "brief" | "film";
  /**
   * Verified ownership manifest for the current generated state.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Requires authenticated generated inventory before current use.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Narrows the manifest only after the evidence gate passes.
   */
  manifest: IAutoMovieGeneratedManifest;
  /**
   * Verified runtime registry for the current generated state.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Refuses current use when the runtime registry is absent or inconsistent.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Narrows the registry only after closure validation.
   */
  registry: IAutoMovieProductionRegistryManifest;
  /**
   * Verified production and world contracts for the current generated state.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Requires both contracts before exposing current generated truth.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Narrows required contracts only after completeness succeeds.
   */
  design: IAutoMovieProductionDesignGraph & {
    /** Required production contract from the verified generated snapshot. */
    production: IAutoMovieProductionDesign;
    /** Required world contract from the verified generated snapshot. */
    world: IAutoMovieWorldDesign;
  };
}

/**
 * Current library state after strict index and artifact closure validation.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Narrows a library only after its graph-selected owner and artifact closure is authenticated.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Keeps library state unavailable when kind, index, lineage, or generated bytes disagree.
 * @author Samchon
 */
export interface IAutoMovieCurrentLibraryGeneratedProjectState extends IAutoMovieGeneratedProjectState {
  kind: "library";
  manifest: IAutoMovieGeneratedManifest;
  library: IAutoMovieMaterializedLibrary;
  registry: null;
}

/**
 * Generated state narrowed by its graph-selected production shape.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Preserves the selected timed or library shape in the current result.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Exposes only the shape whose complete current dependencies were verified.
 * @author Samchon
 */
export type IAutoMovieCurrentGeneratedProjectState =
  | IAutoMovieCurrentTimedGeneratedProjectState
  | IAutoMovieCurrentLibraryGeneratedProjectState;

/**
 * Project state narrowed by {@link requireCurrentAutoMovieProjectState}.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Represents only a snapshot that passed the current-state refusal boundary.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Makes the successful evidence gate explicit in the type.
 * @author Samchon
 */
export interface IAutoMovieCurrentProjectState extends IAutoMovieProjectState {
  /**
   * Freshness narrowed to the successfully verified current state.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Prevents stale or missing output from reaching current-only consumers.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Encodes the passed gate in the returned status.
   */
  freshness: IAutoMovieProjectStateFreshness & { status: "current" };
  /**
   * Generated state whose required components passed the current-state gate.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Refuses nullable required components after narrowing.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Carries only gate-approved generated evidence.
   */
  generated: IAutoMovieCurrentGeneratedProjectState;
}

/**
 *  Load current tracked design and last compiler-owned output.
 *
 * This is a Node I/O boundary for measurement scripts, tests, and offline
 * diagnostics. It must never be imported or called by a shot/film build
 * function: compilation runs those functions in a deterministic no-I/O VM. The
 * loader verifies every consumed generated byte against its ownership manifest
 * and recomputes the current compiler fingerprint without writing.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Recomputes current identity and verifies every consumed generated dependency.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Produces a read-only dependency-based freshness decision.
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-missing-state Reports a missing generated manifest without manufacturing current output.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-missing-state Emits missing only when the required generated manifest is absent.
 * @evidence requirements/diagnostics/README.md#진단-요구사항 Reports project-state findings with explicit input, result, and current/missing/stale classification.
 * @evidence requirements/evidence-and-provenance/README.md#증거와-출처-계보-요구사항 Inspects generated dependency identity, completeness, freshness, and reproducibility before current use.
 * @evidence specifications/evidence-and-provenance/README.md#증거와-출처-계보-시스템-명세 Implements a read-only dependency and freshness gate over generated project state.
 * @evidence specifications/validation-and-diagnostics/README.md#validation과-diagnostics-시스템-명세 Produces input-bound project-state diagnostics without manufacturing successful output.
 * @evidenceExclude requirements/diagnostics/budgets-and-limits.md#diagnostics-budget-exceeded The read-only project-state loader does not implement the diagnostics budget exceeded requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/budgets-and-limits.md#diagnostics-budget-remediation The read-only project-state loader does not implement the diagnostics budget remediation requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/budgets-and-limits.md#diagnostics-truncation-and-omission The read-only project-state loader does not implement the diagnostics truncation and omission requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-aggregate-boundary The read-only project-state loader does not implement the diagnostics aggregate boundary requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-completeness-determinism The read-only project-state loader does not implement the diagnostics completeness determinism requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-duplicates-and-occurrences The read-only project-state loader does not implement the diagnostics duplicates and occurrences requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-fail-fast-boundary The read-only project-state loader does not implement the diagnostics fail fast boundary requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/collection-fail-fast-and-determinism.md#diagnostics-stable-order The read-only project-state loader does not implement the diagnostics stable order requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/external-input-and-security.md#diagnostics-external-failure-stage The read-only project-state loader does not implement the diagnostics external failure stage requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/external-input-and-security.md#diagnostics-quarantine-and-adoption The read-only project-state loader does not implement the diagnostics quarantine and adoption requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/external-input-and-security.md#diagnostics-redaction The read-only project-state loader does not implement the diagnostics redaction requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/external-input-and-security.md#diagnostics-security-refusal The read-only project-state loader does not implement the diagnostics security refusal requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/identity-path-and-context.md#diagnostics-cause-observed-expected The read-only project-state loader does not implement the diagnostics cause observed expected requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference The read-only project-state loader does not implement the diagnostics code catalog reference requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/identity-path-and-context.md#diagnostics-correction-and-recheck The read-only project-state loader does not implement the diagnostics correction and recheck requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/identity-path-and-context.md#diagnostics-identity-stability The read-only project-state loader does not implement the diagnostics identity stability requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/identity-path-and-context.md#diagnostics-location-time-subject-context The read-only project-state loader does not implement the diagnostics location time subject context requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope The read-only project-state loader does not implement the diagnostics path and scope requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/identity-path-and-context.md#diagnostics-severity-and-outcome The read-only project-state loader does not implement the diagnostics severity and outcome requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/localization-and-machine-results.md#diagnostics-accessible-presentation The read-only project-state loader does not implement the diagnostics accessible presentation requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/localization-and-machine-results.md#diagnostics-locale-fallback The read-only project-state loader does not implement the diagnostics locale fallback requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/localization-and-machine-results.md#diagnostics-machine-readable-result The read-only project-state loader does not implement the diagnostics machine readable result requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/localization-and-machine-results.md#diagnostics-safe-localized-export The read-only project-state loader does not implement the diagnostics safe localized export requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/localization-and-machine-results.md#diagnostics-value-unit-time-format The read-only project-state loader does not implement the diagnostics value unit time format requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-delivery-during-failure The read-only project-state loader does not implement the diagnostics delivery during failure requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-partial-retention The read-only project-state loader does not implement the diagnostics partial retention requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-partial-success-boundary The read-only project-state loader does not implement the diagnostics partial success boundary requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-preserve-prior-success The read-only project-state loader does not implement the diagnostics preserve prior success requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/partial-artifacts-and-recovery.md#diagnostics-resume-verified-reuse The read-only project-state loader does not implement the diagnostics resume verified reuse requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-algorithm-change-and-collision The read-only project-state loader does not implement the integrity algorithm change and collision requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-binary-dependency-closure The read-only project-state loader does not implement the integrity binary dependency closure requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-byte-and-semantic-identity The read-only project-state loader does not implement the integrity byte and semantic identity requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-mutable-reference-snapshot The read-only project-state loader does not implement the integrity mutable reference snapshot requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/canonical-digests-and-content-identity.md#integrity-structured-canonicalization The read-only project-state loader does not implement the integrity structured canonicalization requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-boundary-integrity-check The read-only project-state loader does not implement the custody boundary integrity check requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-distributed-copy-verification The read-only project-state loader does not implement the custody distributed copy verification requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-gap-and-quarantine The read-only project-state loader does not implement the custody gap and quarantine requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-signature-attestation-boundary The read-only project-state loader does not implement the custody signature attestation boundary requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-tamper-evident-history The read-only project-state loader does not implement the custody tamper evident history requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-activity-inputs-outputs The read-only project-state loader does not implement the provenance activity inputs outputs requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-agent-role-responsibility The read-only project-state loader does not implement the provenance agent role responsibility requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-entity-and-revision The read-only project-state loader does not implement the provenance entity and revision requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-lineage-gaps The read-only project-state loader does not implement the provenance lineage gaps requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/entities-activities-agents-and-lineage.md#provenance-primary-and-derived-source The read-only project-state loader does not implement the provenance primary and derived source requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-derivation-impact The read-only project-state loader does not implement the provenance derivation impact requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-generated-output-record The read-only project-state loader does not implement the provenance generated output record requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-nondeterministic-generation The read-only project-state loader does not implement the provenance nondeterministic generation requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-selection-and-composition The read-only project-state loader does not implement the provenance selection and composition requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-transformation-record The read-only project-state loader does not implement the provenance transformation record requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-automated-finding-boundary The read-only project-state loader does not implement the evidence automated finding boundary requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-claim-basis The read-only project-state loader does not implement the evidence claim basis requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-disagreement-and-resolution The read-only project-state loader does not implement the evidence disagreement and resolution requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-human-judgment-history The read-only project-state loader does not implement the evidence human judgment history requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observation-conditions The read-only project-state loader does not implement the evidence observation conditions requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-credential-omission The read-only project-state loader does not implement the privacy credential omission requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-erasure-and-lineage The read-only project-state loader does not implement the privacy erasure and lineage requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-external-service-disclosure The read-only project-state loader does not implement the privacy external service disclosure requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-human-identity-and-pseudonym The read-only project-state loader does not implement the privacy human identity and pseudonym requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-redaction-and-source-relation The read-only project-state loader does not implement the privacy redaction and source relation requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-sensitive-metadata The read-only project-state loader does not implement the privacy sensitive metadata requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-archive-retrieval-and-restoration The read-only project-state loader does not implement the retention archive retrieval and restoration requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-freshness-expiry-and-review The read-only project-state loader does not implement the retention freshness expiry and review requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-hold-and-exception The read-only project-state loader does not implement the retention hold and exception requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-invalidation-versus-deletion The read-only project-state loader does not implement the retention invalidation versus deletion requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/retention-invalidation-and-disposal.md#retention-verifiable-disposal The read-only project-state loader does not implement the retention verifiable disposal requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-explicit-status The read-only project-state loader does not implement the evidence explicit status requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-portable-inspection The read-only project-state loader does not implement the evidence portable inspection requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-scope-and-exclusions The read-only project-state loader does not implement the evidence scope and exclusions requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/scope-identity-and-status.md#evidence-subject-record-separation The read-only project-state loader does not implement the evidence subject record separation requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-attribution-propagation The read-only project-state loader does not implement the third party attribution propagation requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-generated-source The read-only project-state loader does not implement the third party generated source requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-rights-and-terms The read-only project-state loader does not implement the third party rights and terms requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-source-access-restriction The read-only project-state loader does not implement the third party source access restriction requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-source-change-and-withdrawal The read-only project-state loader does not implement the third party source change and withdrawal requirement; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-algorithm-migration-collision The read-only project-state loader does not implement the evp algorithm migration collision system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-binary-closure-digest The read-only project-state loader does not implement the evp binary closure digest system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-byte-semantic-identity The read-only project-state loader does not implement the evp byte semantic identity system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-mutable-locator-snapshot The read-only project-state loader does not implement the evp mutable locator snapshot system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/canonical-digests-and-content-identity.md#evp-structured-canonicalization The read-only project-state loader does not implement the evp structured canonicalization system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#evp-custody-boundary-receipt The read-only project-state loader does not implement the evp custody boundary receipt system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#evp-custody-quarantine-state The read-only project-state loader does not implement the evp custody quarantine state system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#evp-distributed-copy-verification The read-only project-state loader does not implement the evp distributed copy verification system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#evp-signature-verification-boundary The read-only project-state loader does not implement the evp signature verification boundary system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#evp-tamper-evident-correction-chain The read-only project-state loader does not implement the evp tamper evident correction chain system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-activity-execution-record The read-only project-state loader does not implement the evp activity execution record system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-actor-role-binding The read-only project-state loader does not implement the evp actor role binding system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-entity-revision-model The read-only project-state loader does not implement the evp entity revision model system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-lineage-gap-representation The read-only project-state loader does not implement the evp lineage gap representation system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/entities-activities-agents-and-lineage.md#evp-primary-derived-source-relation The read-only project-state loader does not implement the evp primary derived source relation system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/generation-transformation-and-derivation.md#evp-derivation-reverse-impact-index The read-only project-state loader does not implement the evp derivation reverse impact index system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/generation-transformation-and-derivation.md#evp-generated-output-receipt The read-only project-state loader does not implement the evp generated output receipt system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/generation-transformation-and-derivation.md#evp-nondeterministic-attempt-model The read-only project-state loader does not implement the evp nondeterministic attempt model system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/generation-transformation-and-derivation.md#evp-selection-composition-record The read-only project-state loader does not implement the evp selection composition record system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/generation-transformation-and-derivation.md#evp-transformation-mapping-and-loss The read-only project-state loader does not implement the evp transformation mapping and loss system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-automated-finding-result The read-only project-state loader does not implement the evp automated finding result system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-claim-evaluation-contract The read-only project-state loader does not implement the evp claim evaluation contract system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-disagreement-resolution The read-only project-state loader does not implement the evp disagreement resolution system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-human-judgment-activity The read-only project-state loader does not implement the evp human judgment activity system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-observation-record-contract The read-only project-state loader does not implement the evp observation record contract system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md#evp-credential-exclusion-gate The read-only project-state loader does not implement the evp credential exclusion gate system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md#evp-erasure-tombstone The read-only project-state loader does not implement the evp erasure tombstone system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md#evp-external-transfer-authorization The read-only project-state loader does not implement the evp external transfer authorization system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md#evp-human-identity-pseudonymization The read-only project-state loader does not implement the evp human identity pseudonymization system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md#evp-redaction-derivative The read-only project-state loader does not implement the evp redaction derivative system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/privacy-credentials-and-disclosure.md#evp-sensitive-metadata-filtering The read-only project-state loader does not implement the evp sensitive metadata filtering system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/retention-invalidation-and-disposal.md#evp-archive-retrieval-activity The read-only project-state loader does not implement the evp archive retrieval activity system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/retention-invalidation-and-disposal.md#evp-disposal-execution-receipt The read-only project-state loader does not implement the evp disposal execution receipt system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/retention-invalidation-and-disposal.md#evp-freshness-expiry-evaluation The read-only project-state loader does not implement the evp freshness expiry evaluation system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/retention-invalidation-and-disposal.md#evp-invalidation-deletion-state The read-only project-state loader does not implement the evp invalidation deletion state system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/retention-invalidation-and-disposal.md#evp-retention-hold The read-only project-state loader does not implement the evp retention hold system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/scope-identity-and-status.md#evp-portable-inspection-view The read-only project-state loader does not implement the evp portable inspection view system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/scope-identity-and-status.md#evp-record-scope-model The read-only project-state loader does not implement the evp record scope model system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/scope-identity-and-status.md#evp-record-status-transition The read-only project-state loader does not implement the evp record status transition system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/scope-identity-and-status.md#evp-subject-record-identity-separation The read-only project-state loader does not implement the evp subject record identity separation system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md#evp-attribution-propagation-closure The read-only project-state loader does not implement the evp attribution propagation closure system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md#evp-generated-provider-provenance The read-only project-state loader does not implement the evp generated provider provenance system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md#evp-restricted-source-verification The read-only project-state loader does not implement the evp restricted source verification system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md#evp-source-terms-change-impact The read-only project-state loader does not implement the evp source terms change impact system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md#evp-third-party-rights-evaluation The read-only project-state loader does not implement the evp third party rights evaluation system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/budget-and-truncation.md#validation-budget-exceeded-result The read-only project-state loader does not implement the validation budget exceeded result system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/budget-and-truncation.md#validation-budget-retry-contract The read-only project-state loader does not implement the validation budget retry contract system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/budget-and-truncation.md#validation-truncation-result The read-only project-state loader does not implement the validation truncation result system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-aggregate-execution The read-only project-state loader does not implement the validation aggregate execution system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-canonical-diagnostic-order The read-only project-state loader does not implement the validation canonical diagnostic order system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-diagnostic-deduplication The read-only project-state loader does not implement the validation diagnostic deduplication system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-fail-fast-execution The read-only project-state loader does not implement the validation fail fast execution system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/collection-order-and-termination.md#validation-result-completeness-determinism The read-only project-state loader does not implement the validation result completeness determinism system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-cause-values The read-only project-state loader does not implement the validation diagnostic cause values system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference The read-only project-state loader does not implement the validation diagnostic code catalog reference system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-correction-revalidation The read-only project-state loader does not implement the validation diagnostic correction revalidation system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-identity-version The read-only project-state loader does not implement the validation diagnostic identity version system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope The read-only project-state loader does not implement the validation diagnostic path scope system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-severity-outcome The read-only project-state loader does not implement the validation diagnostic severity outcome system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-spatiotemporal-subject-location The read-only project-state loader does not implement the validation diagnostic spatiotemporal subject location system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/external-security-and-redaction.md#validation-external-failure-stages The read-only project-state loader does not implement the validation external failure stages system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/external-security-and-redaction.md#validation-quarantine-adoption-state The read-only project-state loader does not implement the validation quarantine adoption state system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/external-security-and-redaction.md#validation-redaction-boundary The read-only project-state loader does not implement the validation redaction boundary system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/external-security-and-redaction.md#validation-security-refusal The read-only project-state loader does not implement the validation security refusal system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/localization-and-machine-results.md#validation-accessible-diagnostic-presentation The read-only project-state loader does not implement the validation accessible diagnostic presentation system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/localization-and-machine-results.md#validation-canonical-value-format The read-only project-state loader does not implement the validation canonical value format system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/localization-and-machine-results.md#validation-locale-fallback The read-only project-state loader does not implement the validation locale fallback system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/localization-and-machine-results.md#validation-machine-result-envelope The read-only project-state loader does not implement the validation machine result envelope system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/localization-and-machine-results.md#validation-safe-localized-export The read-only project-state loader does not implement the validation safe localized export system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md#validation-artifact-refusal-boundary The read-only project-state loader does not implement the validation artifact refusal boundary system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md#validation-diagnostic-failure-channel The read-only project-state loader does not implement the validation diagnostic failure channel system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md#validation-partial-artifact-retention The read-only project-state loader does not implement the validation partial artifact retention system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md#validation-preserve-previous-complete The read-only project-state loader does not implement the validation preserve previous complete system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md#validation-resume-verified-artifacts The read-only project-state loader does not implement the validation resume verified artifacts system responsibility; it only classifies observed local generated-state evidence.
 * @evidenceExclude requirements/diagnostics/input-and-result-classification.md#diagnostics-unknown-state The loader resolves declared local project-state dependencies to current, missing, stale, or invalid states; it does not emit an unknown outcome.
 * @evidenceExclude requirements/diagnostics/input-and-result-classification.md#diagnostics-unsupported-state Unsupported capability classification belongs to the owning compiler or tool, not this filesystem-state inspection.
 * @evidenceExclude requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run The loader performs one synchronous inspection and has no downstream validation stage to classify as not-run.
 * @evidenceExclude requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-unsupported-and-not-run Project-state freshness inspection refuses missing, stale, and invalid evidence but does not model unsupported capability or skipped execution.
 * @evidenceExclude specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-outcome-classification-lattice The loader's freshness vocabulary is intentionally narrower than the general evidence outcome lattice.
 * @evidenceExclude specifications/validation-and-diagnostics/classification-and-causality.md#validation-unknown-state The loader deterministically resolves its local inputs and does not emit the validator-wide unknown state.
 * @evidenceExclude specifications/validation-and-diagnostics/classification-and-causality.md#validation-unsupported-state Capability support is outside filesystem freshness inspection.
 * @evidenceExclude specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states This single-stage inspection has no dependent validator stage to mark not-run after failure.
 */
export const loadAutoMovieProjectState = (
  input: IAutoMovieProjectStateInput,
): IAutoMovieProjectState => {
  const root = path.resolve(input.root);
  const project = AutoMovieProductionProject.openReadOnly(
    root,
    input.productionId,
  );
  const authoringEvidence = input.authoringEvidence;
  const kind =
    authoringEvidence?.manifest.kind === "library"
      ? "library"
      : authoringEvidence?.manifest.kind === "brief"
        ? "brief"
        : "film";
  const revision = project.revision();
  const design = project.graph();
  const problems: IAutoMovieProjectStateProblem[] = [];
  if (
    authoringEvidence !== undefined &&
    path.resolve(authoringEvidence.root) !== root
  )
    problems.push({
      code: "authoring-evidence-invalid",
      path: null,
      message: `Authoring evidence belongs to "${path.resolve(authoringEvidence.root)}", not selected project root "${root}". Reopen the graph from this project before loading state.`,
    });
  let compileStatus: IAutoMovieCompileProjectOutput | null = null;
  try {
    compileStatus = new AutoMovieProductionCompiler(
      project,
      authoringEvidence,
      input.currentAuthoringEvidence,
    ).lint({ scope: "source" });
  } catch (error) {
    problems.push({
      code: "compile-status-unavailable",
      path: null,
      message: messageOf(error),
    });
  }
  if (compileStatus?.success === false)
    problems.push({
      code: "current-compile-invalid",
      path: null,
      message:
        "Current design, source, declared content, or generated ownership does not pass read-only source compilation. Inspect freshness.diagnostics and run the scaffold compile command after correction.",
    });

  let manifest: IAutoMovieGeneratedManifest | null = null;
  let manifestReadFailed = false;
  try {
    manifest = project.generatedManifest();
  } catch (error) {
    manifestReadFailed = true;
    problems.push({
      code: "generated-manifest-invalid",
      path: null,
      message: messageOf(error),
    });
  }
  if (
    manifest?.files.some((file) => file.path === "library/index.json") &&
    authoringEvidence === undefined
  )
    problems.push({
      code: "authoring-evidence-required",
      path: null,
      message:
        "Generated library residue cannot select the production kind. Pass current graph-derived authoring evidence before loading library state.",
    });

  const verified = new Map<string, Uint8Array>();
  const declared = new Set<string>();
  if (manifest !== null)
    for (const file of manifest.files) {
      if (declared.has(file.path)) {
        problems.push({
          code: "generated-file-duplicate",
          path: file.path,
          message: `Generated ownership manifest declares "${file.path}" more than once.`,
        });
        continue;
      }
      declared.add(file.path);
      let bytes: Uint8Array;
      try {
        bytes = project.readGeneratedFile(file.path);
      } catch (error) {
        problems.push({
          code: "generated-file-unreadable",
          path: file.path,
          message: messageOf(error),
        });
        continue;
      }
      const actual = digestAutoMovieBytes(bytes);
      if (actual !== file.digest) {
        problems.push({
          code: "generated-file-modified",
          path: file.path,
          message: `Generated file digest is ${actual}, but the ownership manifest records ${file.digest}. Recompile instead of querying modified compiler output.`,
        });
        continue;
      }
      verified.set(file.path, bytes);
    }

  const registry = parseGeneratedJson(
    verified,
    "manifests/compile.json",
    (value) => typia.assert<IAutoMovieProductionRegistryManifest>(value),
    problems,
  );
  const production = parseGeneratedJson(
    verified,
    "contracts/production.json",
    (value) => typia.assert<IAutoMovieProductionDesign>(value),
    problems,
  );
  const world = parseGeneratedJson(
    verified,
    "contracts/world.json",
    (value) => typia.assert<IAutoMovieWorldDesign>(value),
    problems,
  );
  const models = new Map<string, IAutoMovieModelRecipe>();
  const formations = new Map<string, IAutoMovieFormationDesign>();
  const shots = new Map<string, IAutoMovieShotContract>();
  const acceptance = new Map<string, IAutoMovieAcceptanceScenario>();
  const runtimeModels = new Map<string, IAutoMovieModel>();
  const compiledShots = new Map<string, IAutoMovieCompiledShotSource>();
  const runtimeModelPaths = new Map<string, IAutoMovieModel>();
  const compiledShotPaths = new Map<string, string>();
  const libraryEnvironments = new Map<string, IAutoMovieBuiltEnvironment>();
  const libraryContexts = new Map<string, IAutoMovieEnvironmentContext>();
  let library: IAutoMovieMaterializedLibrary | null = null;
  let film: IAutoMovieFilmTimeline | null = null;

  for (const file of [...verified.keys()].sort(compareCodeUnits)) {
    if (file.startsWith("library/environments/"))
      insertGenerated(
        libraryEnvironments,
        parseGeneratedJson(
          verified,
          file,
          (value) => typia.assert<IAutoMovieBuiltEnvironment>(value),
          problems,
        ),
        file,
        problems,
      );
    else if (file.startsWith("library/contexts/"))
      insertGenerated(
        libraryContexts,
        parseGeneratedJson(
          verified,
          file,
          (value) => typia.assert<IAutoMovieEnvironmentContext>(value),
          problems,
        ),
        file,
        problems,
      );
    else if (file.startsWith("contracts/models/"))
      insertGenerated(
        models,
        parseGeneratedJson(
          verified,
          file,
          (value) => typia.assert<IAutoMovieModelRecipe>(value),
          problems,
        ),
        file,
        problems,
      );
    else if (file.startsWith("contracts/formations/"))
      insertGenerated(
        formations,
        parseGeneratedJson(
          verified,
          file,
          (value) => typia.assert<IAutoMovieFormationDesign>(value),
          problems,
        ),
        file,
        problems,
      );
    else if (file.startsWith("contracts/shots/"))
      insertGenerated(
        shots,
        parseGeneratedJson(
          verified,
          file,
          (value) => typia.assert<IAutoMovieShotContract>(value),
          problems,
        ),
        file,
        problems,
      );
    else if (file.startsWith("contracts/acceptance/"))
      insertGenerated(
        acceptance,
        parseGeneratedJson(
          verified,
          file,
          (value) => typia.assert<IAutoMovieAcceptanceScenario>(value),
          problems,
        ),
        file,
        problems,
      );
    else if (file.startsWith("models/")) {
      const value = parseGeneratedJson(
        verified,
        file,
        (item) => typia.assert<IAutoMovieModel>(item),
        problems,
      );
      if (value !== null) runtimeModelPaths.set(file, value);
    } else if (file.startsWith("shots/")) {
      const value = parseGeneratedJson(
        verified,
        file,
        (item) => typia.assert<IAutoMovieCompiledShotSource>(item),
        problems,
      );
      if (value !== null) {
        if (compiledShots.has(value.shot.id))
          problems.push({
            code: "generated-id-duplicate",
            path: file,
            message: `Generated id "${value.shot.id}" occurs more than once.`,
          });
        else compiledShots.set(value.shot.id, value);
        compiledShotPaths.set(file, value.shot.id);
      }
    } else if (file === "film-timeline.json")
      film = parseGeneratedJson(
        verified,
        file,
        (value) => typia.assert<IAutoMovieFilmTimeline>(value),
        problems,
      );
  }

  if (manifest !== null && kind === "library") {
    const inspection = inspectAutoMovieLibraryProjectState({
      production: project.productionId,
      compiler: manifest.compiler.protocolVersion,
      inputFingerprint: manifest.inputFingerprint,
      authoringEvidence,
      manifest,
      readFile: (file) => verified.get(file) ?? null,
    });
    library = inspection.index;
    problems.push(...inspection.problems);
    for (const model of runtimeModelPaths.values()) {
      if (runtimeModels.has(model.id))
        problems.push({
          code: "generated-id-duplicate",
          path: null,
          message: `Generated library model id "${model.id}" occurs more than once.`,
        });
      else runtimeModels.set(model.id, model);
    }
  } else if (
    manifest !== null &&
    manifest.files.some(
      (file) =>
        file.path === "library/index.json" ||
        file.path.startsWith("library/environments/") ||
        file.path.startsWith("library/contexts/"),
    )
  )
    problems.push({
      code: "generated-shape-mismatch",
      path: "library/index.json",
      message:
        "Timed production evidence cannot adopt library-only generated artifacts. Recompile the graph-selected film or brief shape.",
    });

  if (manifest !== null && registry !== null) {
    if (
      registry.productionId !== project.productionId ||
      registry.inputFingerprint !== manifest.inputFingerprint
    )
      problems.push({
        code: "generated-registry-mismatch",
        path: "manifests/compile.json",
        message: `Generated registry identifies production "${registry.productionId}" at ${registry.inputFingerprint}, but the active ownership manifest identifies "${project.productionId}" at ${manifest.inputFingerprint}.`,
      });
    for (const asset of registry.assets) {
      const model = runtimeModelPaths.get(asset.path);
      if (model === undefined)
        problems.push({
          code: "generated-registry-mismatch",
          path: asset.path,
          message: `Generated registry asset "${asset.id}" does not resolve to a digest-verified runtime model at "${asset.path}".`,
        });
      else runtimeModels.set(asset.id, model);
    }
    for (const shot of registry.shots)
      if (compiledShotPaths.get(shot.path) !== shot.id)
        problems.push({
          code: "generated-registry-mismatch",
          path: shot.path,
          message: `Generated registry shot "${shot.id}" does not resolve to a digest-verified compiled shot at "${shot.path}".`,
        });
    if (
      (registry.film === null && film !== null) ||
      (registry.film !== null && film?.id !== registry.film)
    )
      problems.push({
        code: "generated-registry-mismatch",
        path: "film-timeline.json",
        message: `Generated registry film ${JSON.stringify(registry.film)} does not match the digest-verified film timeline.`,
      });
  }

  if (
    kind !== "library" &&
    manifest !== null &&
    (registry === null || production === null || world === null)
  )
    problems.push({
      code: "generated-state-incomplete",
      path: null,
      message:
        "Generated state lacks a digest-verified compiler registry, production contract, or world contract. Recompile before querying it.",
    });
  if (
    manifest !== null &&
    compileStatus !== null &&
    manifest.inputFingerprint !== compileStatus.compiler.inputFingerprint
  )
    problems.push({
      code: "compile-fingerprint-stale",
      path: null,
      message: `Loaded compile fingerprint ${manifest.inputFingerprint} is stale against current fingerprint ${compileStatus.compiler.inputFingerprint}.`,
    });

  let endingCompileStatus: IAutoMovieCompileProjectOutput | null = null;
  let endingDesign: IAutoMovieProductionDesignGraph = design;
  try {
    const endingRevisionBefore = project.revision();
    const endingCompileStatusBefore = new AutoMovieProductionCompiler(
      project,
      authoringEvidence,
      input.currentAuthoringEvidence,
    ).lint({
      scope: "source",
    });
    endingDesign = project.graph();
    endingCompileStatus = new AutoMovieProductionCompiler(
      project,
      authoringEvidence,
      input.currentAuthoringEvidence,
    ).lint({ scope: "source" });
    const endingManifest = project.generatedManifest();
    const endingRevisionAfter = project.revision();
    if (
      endingRevisionBefore !== revision ||
      endingRevisionAfter !== revision ||
      JSON.stringify(endingManifest) !== JSON.stringify(manifest) ||
      endingCompileStatusBefore.compiler.inputFingerprint !==
        endingCompileStatus.compiler.inputFingerprint ||
      endingCompileStatus.compiler.inputFingerprint !==
        compileStatus?.compiler.inputFingerprint
    )
      problems.push({
        code: "project-state-changed",
        path: null,
        message:
          "Project revision or generated ownership changed while state was loading. Retry against one stable repository snapshot.",
      });
  } catch (error) {
    problems.push({
      code: "project-state-changed",
      path: null,
      message: messageOf(error),
    });
  }

  return {
    root,
    productionId: project.productionId,
    revision,
    freshness: {
      status:
        manifest === null && manifestReadFailed === false
          ? "missing"
          : problems.length === 0
            ? "current"
            : "stale",
      compileFingerprint: manifest?.inputFingerprint ?? null,
      currentFingerprint:
        endingCompileStatus?.compiler.inputFingerprint ??
        compileStatus?.compiler.inputFingerprint ??
        null,
      diagnostics:
        endingCompileStatus?.diagnostics ?? compileStatus?.diagnostics ?? [],
      problems,
    },
    design: endingDesign,
    generated: {
      kind,
      manifest,
      library,
      libraryEnvironments,
      libraryContexts,
      registry,
      design: {
        production,
        models,
        world,
        formations,
        shots,
        acceptance,
      },
      models: runtimeModels,
      shots: compiledShots,
      film,
    },
  };
};

/**
 * Refuse missing or stale output and narrow a loaded state for engine queries.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Refuses current-only queries when required evidence is missing or stale.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Narrows state only after the current evidence gate succeeds.
 */
export const requireCurrentAutoMovieProjectState = (
  state: IAutoMovieProjectState,
): IAutoMovieCurrentProjectState => {
  if (state.freshness.status !== "current")
    throw new Error(
      `AutoMovie generated state is ${state.freshness.status} at revision ${state.revision}: ${state.freshness.problems
        .map((problem) => problem.code)
        .join(", ")}. Run the scaffold compile command before measuring it.`,
    );
  return state as IAutoMovieCurrentProjectState;
};

const parseGeneratedJson = <T>(
  verified: ReadonlyMap<string, Uint8Array>,
  file: string,
  assert: (value: unknown) => T,
  problems: IAutoMovieProjectStateProblem[],
): T | null => {
  const bytes = verified.get(file);
  if (bytes === undefined) return null;
  try {
    return assert(JSON.parse(Buffer.from(bytes).toString("utf8")));
  } catch (error) {
    problems.push({
      code: "generated-json-invalid",
      path: file,
      message: messageOf(error),
    });
    return null;
  }
};

const insertGenerated = <T extends { id: string }>(
  target: Map<string, T>,
  value: T | null,
  file: string,
  problems: IAutoMovieProjectStateProblem[],
): void => {
  if (value === null) return;
  if (target.has(value.id))
    problems.push({
      code: "generated-id-duplicate",
      path: file,
      message: `Generated id "${value.id}" occurs more than once.`,
    });
  else target.set(value.id, value);
};

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
