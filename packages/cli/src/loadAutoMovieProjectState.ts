import {
  AutoMovieContentDigest,
  IAutoMovieAcceptanceScenario,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieFilmTimeline,
  IAutoMovieFormationDesign,
  IAutoMovieGeneratedManifest,
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
} from "@automovie/mcp";
import path from "node:path";
import typia from "typia";

/**
 * Input for loading one active production from an initialized project.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Keeps the selected project and production as explicit input facts.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Carries the exact input revision boundary into diagnostic inspection.
 */
export interface IAutoMovieProjectStateInput {
  /**
   * Project root containing the tracked `.automovie` state directory.
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
}

/**
 * One reason loaded compiler-owned state cannot be treated as current.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Separates a loader result finding from the project input facts.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Classifies the exact derived-state failure boundary.
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
    | "current-compile-invalid"
    | "generated-manifest-invalid"
    | "generated-file-duplicate"
    | "generated-file-unreadable"
    | "generated-file-modified"
    | "generated-json-invalid"
    | "generated-id-duplicate"
    | "generated-registry-mismatch"
    | "compile-fingerprint-stale"
    | "generated-state-incomplete"
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
 */
export interface IAutoMovieGeneratedProjectState {
  /**
   * Ownership manifest that authenticated the loaded files.
   *
   * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Supplies the declared component and digest closure required for current use.
   * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Carries the inventory consumed by the fail-closed gate.
   */
  manifest: IAutoMovieGeneratedManifest | null;
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
 */
export interface IAutoMovieCurrentGeneratedProjectState extends IAutoMovieGeneratedProjectState {
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
 * Project state narrowed by {@link requireCurrentAutoMovieProjectState}.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Represents only a snapshot that passed the current-state refusal boundary.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Makes the successful evidence gate explicit in the type.
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
 * Load current tracked design and last compiler-owned output without MCP.
 *
 * This is a Node I/O boundary for measurement scripts, tests, and offline
 * diagnostics. It must never be imported or called by a shot/film build
 * function: compilation runs those functions in a deterministic no-I/O VM. The
 * loader verifies every consumed generated byte against its ownership manifest
 * and recomputes the current compiler fingerprint without writing.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Recomputes current identity and verifies every consumed generated dependency.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Produces a read-only dependency-based freshness decision.
 * @evidenceExclude requirements/diagnostics/README.md#진단-요구사항 This topic index spans every diagnostic domain; the loader owns project-state inspection.
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-missing-state Reports a missing generated manifest without manufacturing current output.
 * @evidenceExclude requirements/diagnostics/input-and-result-classification.md#diagnostics-unknown-state The loader computes current, stale, or missing from local evidence and exposes no unknown state.
 * @evidenceExclude requirements/diagnostics/input-and-result-classification.md#diagnostics-unsupported-state Project-state loading has no supported-but-unimplemented result class.
 * @evidenceExclude requirements/diagnostics/input-and-result-classification.md#diagnostics-failed-not-run The loader performs every local inspection synchronously and exposes failures as problems rather than a not-run state.
 * @evidenceExclude requirements/evidence-and-provenance/README.md#증거와-출처-계보-요구사항 The README heading indexes provenance across the product; this loader owns generated-state freshness.
 * @evidenceExclude requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-unsupported-and-not-run The local loader has no unsupported or intentionally skipped branch.
 * @evidenceExclude specifications/evidence-and-provenance/README.md#증거와-출처-계보-시스템-명세 This topic index spans the whole evidence system; the loader owns generated-state freshness.
 * @evidenceExclude specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-outcome-classification-lattice The loader exposes current, stale, and missing instead of the full cross-domain outcome lattice.
 * @evidenceExclude specifications/validation-and-diagnostics/README.md#validation과-diagnostics-시스템-명세 This topic index spans all validation domains; the loader owns project-state inspection.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-missing-state Emits missing only when the required generated manifest is absent.
 * @evidenceExclude specifications/validation-and-diagnostics/classification-and-causality.md#validation-unknown-state All loader branches end in current, stale, or missing from observed local evidence.
 * @evidenceExclude specifications/validation-and-diagnostics/classification-and-causality.md#validation-unsupported-state Project-state inspection has no unsupported capability branch.
 * @evidenceExclude specifications/validation-and-diagnostics/classification-and-causality.md#validation-failed-not-run-states The loader executes every local check and records failures rather than not-run.
 */
export const loadAutoMovieProjectState = (
  input: IAutoMovieProjectStateInput,
): IAutoMovieProjectState => {
  const root = path.resolve(input.root);
  const project = AutoMovieProductionProject.openReadOnly(
    root,
    input.productionId,
  );
  const revision = project.revision();
  const design = project.graph();
  const problems: IAutoMovieProjectStateProblem[] = [];
  let compileStatus: IAutoMovieCompileProjectOutput | null = null;
  try {
    compileStatus = new AutoMovieProductionCompiler(project).lint({
      scope: "source",
    });
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
  let film: IAutoMovieFilmTimeline | null = null;

  for (const file of [...verified.keys()].sort(compareCodeUnits)) {
    if (file.startsWith("contracts/models/"))
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
    ).lint({
      scope: "source",
    });
    endingDesign = project.graph();
    endingCompileStatus = new AutoMovieProductionCompiler(project).lint({
      scope: "source",
    });
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
      manifest,
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
