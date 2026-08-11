import {
  AutoMovieContentDigest,
  AutoMovieDiagnosticCode,
  IAutoMovieAcceptanceOutcomeReference,
  IAutoMovieAcceptanceScenario,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledShotSource,
  IAutoMovieDesignTarget,
  IAutoMovieDiagnostic,
  IAutoMovieFilmTimeline,
  IAutoMovieFrameEvidenceReference,
  IAutoMovieGeneratedManifest,
  IAutoMovieModel,
  IAutoMoviePrepareReviewInput,
  IAutoMoviePrepareReviewOutput,
  IAutoMovieRenderBundleManifest,
  IAutoMovieRenditionEvidenceReference,
  IAutoMovieReviewCheck,
  IAutoMovieReviewEvidence,
  IAutoMovieReviewQueue,
  IAutoMovieReviewTarget,
  IAutoMovieStoredReview,
  IAutoMovieSubmitReviewInput,
  IAutoMovieSubmitReviewOutput,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import typia from "typia";

import {
  AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
  AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
  AutoMovieProductionCompiler,
  IAutoMovieReviewQueueSnapshot,
  currentAutoMovieProductionCompilerInputFingerprint,
} from "./AutoMovieProductionCompiler";
import {
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
} from "./AutoMovieProductionProject";
import {
  acceptanceAddressesShot,
  acceptanceCriterionShots,
} from "./acceptanceScope";
import { parseAutoMovieCaptureRuntimeIdentity } from "./captureRuntimeIdentity";
import {
  AUTOMOVIE_REVIEW_FINGERPRINT_PROTOCOL,
  IAutoMovieFingerprintField,
  canonicalAutoMovieJsonBytes,
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "./contentIdentity";
import {
  parseAutoMovieFilmTimeline,
  selectAutoMovieFilmReviewFrames,
} from "./filmTimeline";
import { assertProductionRenditionTimelineDelivery } from "./muxProductionFeatureMp4";
import { productionRenderTargetFingerprint } from "./renderIdentity";
import { autoMovieStorySyncOutcome } from "./storySyncDiagnostics";
import { isProductionFrameTime } from "./validateProductionDesign";

type AutoMovieReviewWorksheet = Omit<
  IAutoMovieSubmitReviewInput,
  "preparedFingerprint"
>;

interface IRenderManifestInventoryEntry {
  path: string;
  manifest: IAutoMovieRenderBundleManifest;
  error: null;
}

interface IInvalidRenderManifestInventoryEntry {
  path: string;
  manifest: null;
  error: string;
}

type AutoMovieRenderBundleManifestV2 = Omit<
  IAutoMovieRenderBundleManifest,
  "version"
> & {
  version: 2;
};

interface ILegacyRenderManifestInventoryEntry {
  path: string;
  target: IAutoMovieRenderBundleManifest["target"];
}

interface IReviewReadContext {
  renderInventory: {
    invalid: IInvalidRenderManifestInventoryEntry[];
    legacy: ILegacyRenderManifestInventoryEntry[];
    all: IRenderManifestInventoryEntry[];
    byTarget: Map<string, IRenderManifestInventoryEntry[]>;
  };
  fingerprints: Map<string, AutoMovieContentDigest>;
  renderContentInputs:
    | ReturnType<AutoMovieProductionProject["contentInputs"]>
    | undefined;
  generatedManifest: IAutoMovieGeneratedManifest | undefined;
  generatedFiles: ReadonlyMap<string, Uint8Array> | undefined;
  renderTargetFingerprints: Map<string, AutoMovieContentDigest>;
  repaintRenditions: Map<
    string,
    | ReturnType<
        AutoMovieProductionProject["verifiedRepaintRenditions"]
      >[number]
    | null
  >;
}

/**
 * Required review criteria in their canonical submission order.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Publishes the complete ordered criterion vocabulary for typed review worksheet producers and validators.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Fixes review criterion ordering as code data shared by review services rather than session-owned knowledge.
 */
export const AUTOMOVIE_REVIEW_CRITERIA = {
  asset: [
    "silhouette-and-proportion",
    "rig-convention-and-rom",
    "material-and-outline-legibility",
    "turntable-coverage",
  ],
  design: [
    "identity-and-references",
    "scope-and-ownership",
    "constraints-and-ranges",
    "downstream-consumability",
    "acceptance-coverage",
  ],
  source: [
    "binding-and-exports",
    "determinism",
    "engine-enforcement",
    "error-and-boundary-paths",
  ],
  shot: [
    "beat-fidelity",
    "staging-readability",
    "performance-credibility",
    "style-intent-justification",
    "representability",
    "acceptance-scenarios",
  ],
  rendition: [
    "visual-fidelity-to-source",
    "temporal-coherence",
    "anatomy-and-artifact-integrity",
    "reference-consistency",
  ],
  sequence: [
    "cross-shot-continuity",
    "rhythm-against-intent",
    "spatial-model-maintenance",
    "coverage-sufficiency",
    "acceptance-scenarios",
  ],
  film: [
    "narrative-completion",
    "tone-consistency",
    "delivery-readiness",
    "acceptance-scenarios",
  ],
} as const;

/**
 * Evidence-bound review ledger driven by an external coding agent.
 *
 * The service never calls an LLM and never grades aesthetic prose. It verifies
 * target identity, exact selectors, actual current PNG and repaint bytes,
 * receipt provenance, checklist coverage, self-consistency and fingerprint
 * freshness, then stores the external agent's worksheet as a tracked record.
 *
 * @evidence requirements/review/scope-and-authority.md#review-validation-decision-boundary Validates evidence while leaving the review outcome with the external reviewer.
 * @evidence requirements/acceptance/uncertainty-and-partial-success.md#acceptance-criterion-verdicts Preserves submitted criterion outcomes without manufacturing a human verdict.
 * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-automated-finding-boundary Keeps deterministic worksheet validation separate from reviewer judgment.
 * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-automated-check-boundary Refuses invalid worksheets without making the aesthetic judgment itself.
 * @evidenceExclude specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-defect-categories Worksheets carry criterion observations, not a defect category taxonomy.
 * @evidenceExclude specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-defect-variation-boundary The service has no defect-versus-accepted-variation classification record.
 * @evidenceExclude specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-severity-priority Criterion outcomes do not assign defect severity or scheduling priority.
 * @evidenceExclude specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-reproduction-frequency The service stores no defect reproduction state or frequency.
 * @evidenceExclude specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-duplicate-common-impact The worksheet model has no duplicate-defect or shared-impact relation.
 */
export class AutoMovieProductionReviewService {
  public constructor(
    private readonly project: AutoMovieProductionProject,
    private readonly compileStatus: () => IAutoMovieCompileProjectOutput = () =>
      new AutoMovieProductionCompiler(project).lint({ scope: "source" }),
  ) {}

  /**
   * Prepare current selectors, frames and required criteria for one target.
   *
   * @evidence requirements/review/reproducible-context.md#review-context-source-artifact-identity Prepares review from current target-local source and artifact identities.
   * @evidence specifications/review-and-acceptance/target-scope-and-context.md#review-system-source-artifact-binding Binds the worksheet to exact source and artifact identities.
   */
  public prepare(
    input: IAutoMoviePrepareReviewInput,
  ): IAutoMoviePrepareReviewOutput {
    const compileBound =
      input.target.kind === "asset" ||
      input.target.kind === "source" ||
      input.target.kind === "shot" ||
      input.target.kind === "rendition" ||
      input.target.kind === "sequence" ||
      input.target.kind === "film";
    const compileStatus = compileBound ? this.compileStatus() : null;
    const visual =
      input.target.kind === "asset" ||
      input.target.kind === "shot" ||
      input.target.kind === "rendition" ||
      input.target.kind === "sequence" ||
      input.target.kind === "film";
    const context: IReviewReadContext | undefined = visual
      ? {
          renderInventory: collectRenderManifestInventory(this.project),
          fingerprints: new Map(),
          renderContentInputs: undefined,
          generatedManifest: undefined,
          generatedFiles: undefined,
          renderTargetFingerprints: new Map(),
          repaintRenditions: new Map(),
        }
      : undefined;
    return this.prepareWithStatus(input, compileStatus, context);
  }

  private prepareWithStatus(
    input: IAutoMoviePrepareReviewInput,
    compileStatus: IAutoMovieCompileProjectOutput | null,
    context?: IReviewReadContext,
  ): IAutoMoviePrepareReviewOutput {
    const graph = this.project.graph();
    const diagnostics: IAutoMovieDiagnostic[] = [];
    const targetValue = targetValueOf(this.project, input.target);
    if (targetValue === null)
      diagnostics.push({
        code: "review-target-missing",
        category: "error",
        phase: "review",
        target: reviewTargetKey(input.target),
        path: targetPath(this.project, input.target),
        message:
          "The review target does not exist in current project bytes. Inspect the project and prepare a current target.",
      });
    if (input.target.kind === "source" && compileStatus !== null) {
      const sourcePath = input.target.path;
      const boundShots = new Set(
        [...graph.shots]
          .filter(([, shot]) => shot.source.module === sourcePath)
          .map(([id]) => `shot:${id}`),
      );
      diagnostics.push(
        ...compileStatus.diagnostics.filter(
          (diagnostic) =>
            diagnostic.category === "error" &&
            (diagnostic.path === sourcePath ||
              ((diagnostic.phase === "source" ||
                diagnostic.phase === "compile") &&
                boundShots.has(diagnostic.target))),
        ),
      );
      if (
        compileStatus.diagnostics.some(
          (diagnostic) =>
            diagnostic.category === "error" && diagnostic.phase === "design",
        )
      )
        diagnostics.push({
          code: "review-source-compile-blocked",
          category: "error",
          phase: "review",
          target: reviewTargetKey(input.target),
          path: sourcePath,
          message:
            "Design or model materialization errors prevented a trustworthy execution of this source. Correct the upstream compile blockers, then prepare this source review again.",
        });
    }
    const frames = currentFrames(
      this.project,
      input.target,
      diagnostics,
      compileStatus!,
      context,
    );
    const renditions = currentRenditions(
      this.project,
      input.target,
      diagnostics,
      context,
    );
    if (
      input.target.kind === "film" &&
      graph.production?.visualDelivery === "repainted" &&
      compileStatus !== null
    )
      appendRenditionDeliveryReviewDiagnostic(
        diagnostics,
        this.project,
        input.target.id,
        compileStatus,
        renditions,
        context,
      );
    if (input.target.kind === "rendition" && compileStatus !== null) {
      const sourceTarget: IAutoMovieReviewTarget = {
        kind: "shot",
        id: input.target.id,
      };
      const currentSourceFingerprint = reviewFingerprint(
        this.project,
        sourceTarget,
        compileStatus,
        context,
      );
      const sourceReview = this.project.review(sourceTarget);
      if (
        sourceReview === null ||
        sourceReview.fingerprint !== currentSourceFingerprint ||
        sourceReview.complete === false
      )
        diagnostics.push({
          code: "review-rendition-source-unapproved",
          category: "error",
          phase: "review",
          target: reviewTargetKey(input.target),
          path: targetPath(this.project, sourceTarget),
          message: `Rendition review requires a current completed deterministic shot review for "${input.target.id}". Complete the source-shot review before reviewing repaint output.`,
        });
    }
    const outcomes = currentAcceptanceOutcomes(
      this.project,
      input.target,
      diagnostics,
      compileStatus!,
      context,
    );
    if (
      visualReviewTarget(input.target) &&
      input.target.kind !== "rendition" &&
      frames.length === 0 &&
      diagnostics.some(
        (diagnostic) => diagnostic.code === "review-evidence-missing",
      ) === false
    )
      diagnostics.push({
        code: "review-evidence-missing",
        category: "error",
        phase: "review",
        target: reviewTargetKey(input.target),
        path: null,
        message:
          "This visual target has no verified current PNG frame. Capture every required current view and pass before submitReview. Correction feedback does not authorize deleting the artifact.",
      });
    const quotable =
      input.target.kind === "design" && targetValue !== null
        ? jsonPointers(targetValue, input.target.design)
        : input.target.kind === "asset"
          ? targetValue === null
            ? []
            : jsonPointers(targetValue, {
                kind: "model",
                id: input.target.id,
              })
          : input.target.kind === "source"
            ? sourceSelectors(this.project, input.target.path, diagnostics)
            : input.target.kind === "shot"
              ? shotSourceSelectors(
                  this.project,
                  graph.shots.get(input.target.id)?.source.module,
                  diagnostics,
                )
              : input.target.kind === "sequence" || input.target.kind === "film"
                ? sourceSelectors(this.project, "src/film.ts", diagnostics)
                : [];
    const safeDiagnostics = diagnostics
      .map(appendReviewCorrectionSafety)
      .sort(compareDiagnostics);
    return {
      target: input.target,
      fingerprint: reviewFingerprint(
        this.project,
        input.target,
        compileStatus,
        context,
      ),
      requiredCriteria: [...criteriaOf(input.target)],
      quotable,
      frames,
      renditions,
      outcomes,
      diagnostics: safeDiagnostics,
    };
  }

  /**
   * Validate and store one external-agent review worksheet.
   *
   * @evidence requirements/review/records-and-completeness.md#review-completeness-claim Refuses any incomplete criterion set.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-completeness-claim Rechecks current evidence before storing completion.
   */
  public submit(
    input: IAutoMovieSubmitReviewInput,
  ): IAutoMovieSubmitReviewOutput {
    const prepared = this.prepare({ target: input.target });
    if (input.preparedFingerprint !== prepared.fingerprint)
      return refused(this.project, input.target, prepared.fingerprint, [
        {
          code: "review-worksheet-stale",
          category: "error",
          phase: "review",
          target: reviewTargetKey(input.target),
          path: targetPath(this.project, input.target),
          message: `Submitted worksheet fingerprint ${input.preparedFingerprint} differs from current ${prepared.fingerprint}. Run prepareReview again and review the current evidence before submitReview.`,
        },
      ]);
    const diagnostics = [
      ...prepared.diagnostics.filter(
        (diagnostic) => diagnostic.category === "error",
      ),
      ...validateWorksheet(this.project, input, prepared),
    ];
    if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
      return refused(
        this.project,
        input.target,
        prepared.fingerprint,
        diagnostics,
      );
    const finalCompileStatus = visualReviewTarget(input.target)
      ? this.compileStatus()
      : null;
    const fingerprint = reviewFingerprint(
      this.project,
      input.target,
      finalCompileStatus,
    );
    if (fingerprint !== prepared.fingerprint)
      return refused(this.project, input.target, fingerprint, [
        {
          code: "review-target-raced",
          category: "error",
          phase: "review",
          target: reviewTargetKey(input.target),
          path: targetPath(this.project, input.target),
          message:
            "Target bytes changed while review evidence was validated. Run prepareReview again against the current target.",
        },
      ]);
    const stored: IAutoMovieStoredReview = {
      version: 1,
      target: input.target,
      fingerprint,
      observations: input.observations,
      checks: input.checks,
      corrections: input.corrections,
      completionBasis: input.completionBasis,
      complete: input.complete,
    };
    try {
      this.project.commitReview(
        stored,
        () =>
          reviewFingerprint(
            this.project,
            input.target,
            finalCompileStatus,
            undefined,
            input.target.kind === "sequence" || input.target.kind === "film"
              ? currentAutoMovieProductionCompilerInputFingerprint(
                  this.project,
                  "source",
                )
              : undefined,
          ) === fingerprint,
      );
    } catch (error) {
      if (error instanceof AutoMovieProductionInputRaceError === false)
        throw error;
      const current = this.prepare({ target: input.target }).fingerprint;
      return refused(this.project, input.target, current, [
        {
          code: "review-target-raced",
          category: "error",
          phase: "review",
          target: reviewTargetKey(input.target),
          path: targetPath(this.project, input.target),
          message: `${error.message} Run prepareReview again against the current target and evidence before submitReview.`,
        },
      ]);
    }
    return {
      accepted: true,
      target: input.target,
      fingerprint,
      state: reviewState(stored),
      diagnostics: [],
    };
  }

  /**
   * Derive missing, stale, incomplete, revise and complete states.
   *
   * A compiler-provided snapshot reuses the exact declared content bytes that
   * formed its input fingerprint instead of opening a second filesystem scan.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Distinguishes missing, stale, incomplete, revise, and complete review state.
   * @evidence requirements/review/records-and-completeness.md#review-planned-actual-coverage Compares required queue entries with the actual current review records.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Reports the queue state without implying a verdict.
   */
  public queue(
    currentCompileStatus: IAutoMovieCompileProjectOutput = this.compileStatus(),
    snapshot?: IAutoMovieReviewQueueSnapshot,
  ): IAutoMovieReviewQueue {
    const compileStatus = currentCompileStatus;
    const context: IReviewReadContext = {
      renderInventory: collectRenderManifestInventory(this.project),
      fingerprints: new Map(),
      renderContentInputs: snapshot?.renderContentInputs,
      generatedManifest: snapshot?.generatedManifest,
      generatedFiles: snapshot?.generatedFiles,
      renderTargetFingerprints: new Map(),
      repaintRenditions: new Map(),
    };
    const entries = reviewTargets(this.project, context).map((target) => {
      const currentFingerprint = reviewFingerprint(
        this.project,
        target,
        compileStatus,
        context,
      );
      const stored = this.project.review(target);
      const prepared =
        stored === null || stored.fingerprint !== currentFingerprint
          ? null
          : this.prepareWithStatus(
              { target },
              target.kind === "asset" ||
                target.kind === "source" ||
                target.kind === "shot" ||
                target.kind === "rendition" ||
                target.kind === "sequence" ||
                target.kind === "film"
                ? compileStatus
                : null,
              context,
            );
      const storedDiagnostics =
        stored === null || prepared === null
          ? []
          : [
              ...prepared.diagnostics.filter(
                (diagnostic) => diagnostic.category === "error",
              ),
              ...validateWorksheet(this.project, stored, prepared),
            ];
      return {
        target,
        state:
          stored === null
            ? ("missing" as const)
            : stored.fingerprint !== currentFingerprint
              ? ("stale" as const)
              : storedDiagnostics.some(
                    (diagnostic) => diagnostic.category === "error",
                  )
                ? ("incomplete" as const)
                : reviewState(stored),
        currentFingerprint,
        storedFingerprint: stored?.fingerprint ?? null,
      };
    });
    return { entries };
  }
}

const validateWorksheet = (
  project: AutoMovieProductionProject,
  input: AutoMovieReviewWorksheet,
  prepared: IAutoMoviePrepareReviewOutput,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const add = (code: AutoMovieDiagnosticCode, message: string): void => {
    diagnostics.push({
      code,
      category: "error",
      phase: "review",
      target: reviewTargetKey(input.target),
      path: null,
      message,
    });
  };
  if (input.observations.trim().length === 0)
    add(
      "review-observation-empty",
      "Overall observations are blank. Record concrete current-target observations before submitReview.",
    );
  if (input.completionBasis.trim().length === 0)
    add(
      "review-completion-basis-empty",
      "Completion basis is blank. Cite the decisive checks and evidence before the complete field.",
    );
  const expected = prepared.requiredCriteria;
  const actual = input.checks.map((check) => check.criterion);
  if (
    actual.length !== expected.length ||
    actual.some((criterion, index) => criterion !== expected[index])
  )
    add(
      "review-checklist-incomplete",
      `Criteria must appear exactly once in canonical order: ${expected.join(", ")}. Rewrite checks before submitReview.`,
    );
  const copies = new Set<string>();
  const reusedEvidence = new Set<string>();
  for (const check of input.checks) {
    if (
      check.criterion !== "acceptance-scenarios" &&
      (check.acceptanceScenarios?.length ?? 0) !== 0
    )
      add(
        "review-acceptance-coverage-misplaced",
        `Criterion "${check.criterion}" cannot claim acceptance scenario ids. Put them only on acceptance-scenarios.`,
      );
    if (check.observation.trim().length === 0)
      add(
        "review-observation-empty",
        `Criterion "${check.criterion}" has a blank observation. Record a criterion-specific observation.`,
      );
    if (check.evidence.length === 0)
      add(
        "review-evidence-missing",
        `Criterion "${check.criterion}" has no evidence. Quote current design, source, frame, or diagnostic evidence.`,
      );
    const copyKey = `${check.observation.trim()}\0${canonicalizeAutoMovieJson(
      check.evidence,
    )}`;
    if (copies.has(copyKey))
      add(
        "review-observation-copied",
        `Criterion "${check.criterion}" duplicates another observation and evidence set. Record what this criterion independently establishes.`,
      );
    copies.add(copyKey);
    for (const evidence of check.evidence) {
      const evidenceKey = reviewEvidenceIdentity(evidence);
      if (
        (input.target.kind === "design" || input.target.kind === "source") &&
        reusedEvidence.has(evidenceKey)
      )
        add(
          "review-evidence-reused",
          `Criterion "${check.criterion}" reuses the same evidence item as another criterion. Inspect and cite a distinct current selector for each design or source concern.`,
        );
      reusedEvidence.add(evidenceKey);
      diagnostics.push(
        ...validateEvidence(project, input.target, evidence, prepared, check),
      );
    }
  }
  if (input.complete) {
    for (const check of input.checks)
      if (check.verdict !== "pass")
        add(
          "review-required-criterion-not-passed",
          `Required criterion "${check.criterion}" must pass before complete can be true; not-applicable cannot discharge a required checklist entry.`,
        );
    if (input.checks.some((check) => check.verdict === "revise"))
      add(
        "review-self-contradiction",
        "complete is true while at least one criterion says revise. Correct the target or set complete false.",
      );
    if (input.corrections.length !== 0)
      add(
        "review-self-contradiction",
        "complete is true while corrections remain. Apply them or set complete false.",
      );
    if (
      visualReviewTarget(input.target) &&
      input.target.kind !== "rendition" &&
      input.checks.some((check) =>
        check.evidence.some((evidence) => evidence.kind === "frame"),
      ) === false
    )
      add(
        "review-evidence-missing",
        "A visual target cannot complete without a verified current frame. Capture and cite one required frame.",
      );
    if (input.target.kind === "asset") {
      const targetId = input.target.id;
      const cited = new Set(
        input.checks.flatMap((check) =>
          check.evidence.flatMap((evidence) =>
            evidence.kind === "frame" &&
            evidence.target.kind === "asset" &&
            evidence.target.id === targetId
              ? [evidence.reviewFrame]
              : [],
          ),
        ),
      );
      const missing = prepared.frames
        .map((frame) => frame.reviewFrame)
        .filter((reviewFrame) => cited.has(reviewFrame) === false);
      if (missing.length !== 0)
        add(
          "review-asset-view-coverage-incomplete",
          `A completed asset review must cite every required current view digest. Missing: ${missing.join(", ")}.`,
        );
    }
    if (prepared.renditions.length !== 0) {
      const requiredShots = [
        ...new Set(prepared.renditions.map((rendition) => rendition.shot)),
      ];
      const citedShots = new Set(
        input.checks.flatMap((check) =>
          check.evidence.flatMap((evidence) =>
            evidence.kind === "rendition" ? [evidence.shot] : [],
          ),
        ),
      );
      const missing = requiredShots.filter(
        (shot) => citedShots.has(shot) === false,
      );
      if (missing.length !== 0)
        add(
          "review-rendition-coverage-incomplete",
          `A completed repainted-delivery review must cite one current receipt-bound rendition for every addressed shot. Missing: ${missing.join(", ")}.`,
        );
    }
    for (const criterion of highRiskCriteria(input.target)) {
      if (input.completionBasis.includes(criterion) === false)
        add(
          "review-completion-basis-incomplete",
          `Completion basis does not name high-risk criterion "${criterion}". Reconfirm it with current evidence.`,
        );
      if (
        input.checks.find((check) => check.criterion === criterion)?.verdict !==
        "pass"
      )
        add(
          "review-high-risk-not-passed",
          `High-risk criterion "${criterion}" must pass before complete can be true. Use not-applicable only on genuinely optional criteria.`,
        );
    }
    diagnostics.push(...validateAcceptanceCoverage(project, input, prepared));
  } else if (
    input.corrections.length === 0 &&
    input.checks.some((check) => check.verdict === "revise") === false
  )
    add(
      "review-self-contradiction",
      "complete is false but no revise verdict or correction explains the next round. Add an actionable correction.",
    );
  for (const correction of input.corrections)
    if (
      correction.target.trim().length === 0 ||
      correction.problem.trim().length === 0 ||
      correction.expected.trim().length === 0
    )
      add(
        "review-correction-empty",
        "Every correction requires target, problem, and expected state. Complete the correction before submitReview.",
      );
  return diagnostics;
};

/**
 * Identity of one submitted evidence selector after its value-normalization
 * rules are applied. In particular, source truth is line-addressed and trimmed
 * during validation, so cosmetic whitespace in `exactText` cannot manufacture a
 * second selector for another criterion.
 */
const reviewEvidenceIdentity = (evidence: IAutoMovieReviewEvidence): string => {
  if (evidence.kind === "source")
    return `source\0${evidence.path}\0${evidence.line}`;
  if (evidence.kind === "design")
    return `design\0${canonicalizeAutoMovieJson(evidence.target)}\0${evidence.pointer}`;
  return canonicalizeAutoMovieJson(evidence);
};

const validateAcceptanceCoverage = (
  project: AutoMovieProductionProject,
  input: AutoMovieReviewWorksheet,
  prepared: IAutoMoviePrepareReviewOutput,
): IAutoMovieDiagnostic[] => {
  if (
    input.target.kind !== "shot" &&
    input.target.kind !== "sequence" &&
    input.target.kind !== "film"
  )
    return [];
  const target = input.target;
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const graph = project.graph();
  let filmTimeline: IAutoMovieFilmTimeline | null = null;
  if (target.kind === "sequence" || target.kind === "film") {
    const generated = project.generatedManifest();
    if (generated !== null)
      try {
        filmTimeline = currentFilmTimeline(project, generated.inputFingerprint);
      } catch {}
  }
  const sequenceShots =
    target.kind === "sequence"
      ? new Set(sequenceShotIds(project, target.id))
      : undefined;
  const scenarios = [...graph.acceptance.values()]
    .filter(
      (scenario) =>
        scenario.required &&
        (target.kind === "film" ||
          (target.kind === "sequence" &&
            [...(sequenceShots ?? [])].some((shot) =>
              acceptanceAddressesShot(scenario, shot),
            )) ||
          acceptanceAddressesShot(scenario, target.id)),
    )
    .filter(
      (scenario) =>
        target.kind === "shot" ||
        filmTimeline === null ||
        acceptanceBelongsToFilm(
          graph,
          scenario,
          filmTimeline,
          currentAcceptanceEventTime(project, scenario),
        ),
    )
    .sort((left, right) => compareCodeUnits(left.id, right.id));
  const check = input.checks.find(
    (item) => item.criterion === "acceptance-scenarios",
  );
  const actual = [...(check?.acceptanceScenarios ?? [])].sort(compareCodeUnits);
  const expected = scenarios.map((scenario) => scenario.id);
  const add = (scenario: string, message: string): void => {
    diagnostics.push({
      code: "review-acceptance-coverage-incomplete",
      category: "error",
      phase: "review",
      target: reviewTargetKey(input.target),
      path: null,
      message: `Required acceptance "${scenario}": ${message}`,
    });
  };
  if (sameStringSet(actual, expected) === false)
    add(
      expected.join(", ") || "(none)",
      `the acceptance-scenarios check must list the exact current required ids: ${expected.join(", ") || "(none)"}.`,
    );
  for (const scenario of scenarios) {
    if (
      check?.evidence.some(
        (evidence) =>
          evidence.kind === "acceptance" &&
          evidence.scenario === scenario.id &&
          canonicalizeAutoMovieJson(evidence.exactValue) ===
            canonicalizeAutoMovieJson(scenario),
      ) !== true
    )
      add(
        scenario.id,
        "cite its exact current acceptance contract in the acceptance-scenarios check.",
      );
    const criterion = scenario.criterion;
    if (criterion.kind === "frame") {
      // Graph validation requires criterion.shot for film targets, so the
      // target id fallback is exactly the owning shot id for every valid graph.
      const shot = criterion.shot ?? scenario.target.id;
      if (
        shot === undefined ||
        check?.evidence.some(
          (evidence) =>
            evidence.kind === "frame" &&
            evidence.target.kind === "shot" &&
            evidence.target.id === shot &&
            evidence.reviewFrame === criterion.frame &&
            evidence.pass === criterion.pass &&
            prepared.frames.some(
              (frame) =>
                canonicalizeAutoMovieJson(frame.target) ===
                  canonicalizeAutoMovieJson(evidence.target) &&
                frame.reviewFrame === evidence.reviewFrame &&
                frame.bundle === evidence.bundle &&
                frame.frame === evidence.frame &&
                frame.time === evidence.time &&
                frame.pass === evidence.pass &&
                frame.digest === evidence.digest,
            ),
        ) !== true
      )
        add(
          scenario.id,
          `cite the exact current frame "${criterion.frame}" pass "${criterion.pass}" from shot "${String(shot)}".`,
        );
    } else {
      const outcome = prepared.outcomes.find(
        (candidate) => candidate.scenario === scenario.id,
      );
      if (
        outcome === undefined ||
        outcome.passed === false ||
        check?.evidence.some(
          (evidence) =>
            evidence.kind === "outcome" &&
            evidence.scenario === scenario.id &&
            canonicalizeAutoMovieJson(evidence.exactValue) ===
              canonicalizeAutoMovieJson(outcome),
        ) !== true
      )
        add(
          scenario.id,
          criterion.kind === "event"
            ? `cite the passing compiler-derived outcome for event "${criterion.event}". The acceptance contract itself is not event evidence.`
            : criterion.kind === "story-sync"
              ? `cite the passing compiler-derived story-clock outcome for ${criterion.events.map((entry) => `"${entry.event}" of shot "${entry.shot}"`).join(" and ")}. Adjacency in the edit is not evidence that these events share a moment.`
              : `cite the passing compiler-derived "${criterion.metric}" outcome. The acceptance threshold itself is not a measured result.`,
        );
    }
  }
  return diagnostics;
};

const validateEvidence = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  evidence: IAutoMovieReviewEvidence,
  prepared: IAutoMoviePrepareReviewOutput,
  check: IAutoMovieReviewCheck,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (code: AutoMovieDiagnosticCode, message: string): void => {
    diagnostics.push({
      code,
      category: "error",
      phase: "review",
      target: reviewTargetKey(target),
      path: null,
      message: `Criterion "${check.criterion}": ${message}`,
    });
  };
  if (evidence.kind === "design") {
    if (
      !(
        (target.kind === "design" &&
          sameDesignTarget(target.design, evidence.target)) ||
        (target.kind === "asset" &&
          evidence.target.kind === "model" &&
          evidence.target.id === target.id)
      )
    )
      fail(
        "review-evidence-target-mismatch",
        "design evidence addresses a different target. Quote the prepared target.",
      );
    else {
      const current = targetValueOf(project, target);
      const resolved = resolveJsonPointer(current, evidence.pointer);
      if (resolved.found === false)
        fail(
          "review-evidence-selector-invalid",
          `JSON pointer "${evidence.pointer}" does not exist. Use a selector returned by prepareReview.`,
        );
      else if (
        canonicalizeAutoMovieJson(resolved.value) !==
        canonicalizeAutoMovieJson(evidence.exactValue)
      )
        fail(
          "review-evidence-stale",
          `JSON pointer "${evidence.pointer}" no longer equals exactValue. Prepare the review again.`,
        );
    }
  } else if (evidence.kind === "source") {
    const allowed = prepared.quotable.some(
      (selector) =>
        selector.kind === "source" &&
        selector.path === evidence.path &&
        selector.line === evidence.line,
    );
    if (allowed === false)
      fail(
        "review-evidence-selector-invalid",
        `Source ${evidence.path}:${evidence.line} is not a prepared selector. Quote a current owned line.`,
      );
    else if (evidence.exactText.trim().length === 0)
      fail(
        "review-evidence-empty",
        "source exactText is blank. Quote concrete non-whitespace source.",
      );
    else {
      const selector = prepared.quotable.find(
        (item) =>
          item.kind === "source" &&
          item.path === evidence.path &&
          item.line === evidence.line,
      );
      if (
        selector?.kind !== "source" ||
        currentSourceLine(project, evidence.path, evidence.line).trim() !==
          evidence.exactText.trim()
      )
        fail(
          "review-evidence-stale",
          `Source ${evidence.path}:${evidence.line} no longer exactly equals exactText. Prepare the review again.`,
        );
    }
  } else if (evidence.kind === "frame") {
    const frame = prepared.frames.find(
      (item) =>
        canonicalizeAutoMovieJson(item.target) ===
          canonicalizeAutoMovieJson(evidence.target) &&
        item.reviewFrame === evidence.reviewFrame &&
        item.bundle === evidence.bundle &&
        item.frame === evidence.frame &&
        item.time === evidence.time &&
        item.pass === evidence.pass &&
        item.digest === evidence.digest,
    );
    if (frame === undefined)
      fail(
        "review-evidence-stale",
        "frame evidence is not in the current verified bundle inventory. Capture and prepare the current frame.",
      );
    else if (
      evidence.region !== undefined &&
      (Number.isInteger(evidence.region.x) === false ||
        Number.isInteger(evidence.region.y) === false ||
        Number.isInteger(evidence.region.width) === false ||
        Number.isInteger(evidence.region.height) === false ||
        evidence.region.x < 0 ||
        evidence.region.y < 0 ||
        evidence.region.width <= 0 ||
        evidence.region.height <= 0 ||
        evidence.region.x + evidence.region.width > frame.width ||
        evidence.region.y + evidence.region.height > frame.height)
    )
      fail(
        "review-evidence-region-invalid",
        "frame region must be a non-empty integer rectangle inside the current image.",
      );
  } else if (evidence.kind === "rendition") {
    const { kind: _kind, ...submitted } = evidence;
    if (
      prepared.renditions.some(
        (rendition) =>
          canonicalizeAutoMovieJson(rendition) ===
          canonicalizeAutoMovieJson(submitted),
      ) === false
    )
      fail(
        "review-evidence-stale",
        "rendition evidence is not in the current byte- and receipt-verified inventory. Prepare and inspect the current repainted output.",
      );
  } else if (evidence.kind === "diagnostic") {
    const diagnostic = prepared.diagnostics.find(
      (item) =>
        item.code === evidence.code && (item.path ?? "") === evidence.path,
    );
    if (diagnostic === undefined)
      fail(
        "review-evidence-stale",
        "diagnostic evidence is not in the current prepare snapshot.",
      );
    else if (
      canonicalizeAutoMovieJson(evidence.actual) !==
      canonicalizeAutoMovieJson(diagnostic.message)
    )
      fail(
        "review-evidence-stale",
        "diagnostic actual must exactly equal the current diagnostic message.",
      );
  } else if (evidence.kind === "outcome") {
    const current = prepared.outcomes.find(
      (outcome) => outcome.scenario === evidence.scenario,
    );
    if (
      current === undefined ||
      canonicalizeAutoMovieJson(current) !==
        canonicalizeAutoMovieJson(evidence.exactValue)
    )
      fail(
        "review-evidence-stale",
        `acceptance outcome "${evidence.scenario}" is absent or no longer equals exactValue. Prepare the current compiler/oracle outcome again.`,
      );
  } else {
    const current = project.graph().acceptance.get(evidence.scenario);
    if (
      current === undefined ||
      current.required === false ||
      (target.kind === "shot" &&
        acceptanceAddressesShot(current, target.id) === false) ||
      (target.kind === "sequence" &&
        sequenceShotIds(project, target.id).every(
          (shot) => acceptanceAddressesShot(current, shot) === false,
        )) ||
      (target.kind !== "shot" &&
        target.kind !== "sequence" &&
        target.kind !== "film") ||
      canonicalizeAutoMovieJson(current) !==
        canonicalizeAutoMovieJson(evidence.exactValue)
    )
      fail(
        "review-evidence-stale",
        `acceptance scenario "${evidence.scenario}" is not a current required scenario for this visual target or exactValue is stale.`,
      );
  }
  return diagnostics;
};

const currentSourceLine = (
  project: AutoMovieProductionProject,
  sourcePath: string,
  line: number,
): string => {
  try {
    const source = Buffer.from(
      normalizeAutoMovieSource(project.readSource(sourcePath)),
    ).toString("utf8");
    return source.split("\n")[line - 1] ?? "";
  } catch {
    return "";
  }
};

const targetValueOf = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
): unknown => {
  if (target.kind === "asset")
    return project.graph().models.get(target.id) ?? null;
  if (target.kind === "design") return project.design(target.design);
  if (target.kind === "source") {
    try {
      return Buffer.from(
        normalizeAutoMovieSource(project.readSource(target.path)),
      ).toString("utf8");
    } catch {
      return null;
    }
  }
  const graph = project.graph();
  if (target.kind === "shot") return graph.shots.get(target.id) ?? null;
  if (target.kind === "rendition")
    return project.verifiedRepaintRenditions([target.id])[0] ?? null;
  if (target.kind === "sequence")
    return (
      project
        .screenplayIndex()
        ?.treatment.sequences.find((sequence) => sequence.id === target.id) ??
      null
    );
  return graph.production?.id === target.id ? graph.production : null;
};

const reviewFingerprint = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  compileStatus: IAutoMovieCompileProjectOutput | null,
  context?: IReviewReadContext,
  currentCompileInput?: AutoMovieContentDigest | null,
): AutoMovieContentDigest => {
  const targetKey = reviewTargetKey(target);
  const retained = context?.fingerprints.get(targetKey);
  if (retained !== undefined) return retained;
  const fields: IAutoMovieFingerprintField[] = [
    {
      role: "protocol",
      kind: "review",
      payload: Buffer.from(AUTOMOVIE_REVIEW_FINGERPRINT_PROTOCOL, "utf8"),
    },
    {
      role: "production",
      kind: "namespace",
      payload: Buffer.from(project.productionId, "utf8"),
    },
    {
      role: "target",
      kind: target.kind,
      payload: Buffer.from(reviewTargetKey(target), "utf8"),
    },
  ];
  const addJson = (role: string, value: unknown): void => {
    fields.push({
      role,
      kind: value === null ? "absent" : "canonical-json",
      payload:
        value === null ? new Uint8Array() : canonicalAutoMovieJsonBytes(value),
    });
  };
  const graph = project.graph();
  if (target.kind === "asset") {
    addJson("model-recipe", graph.models.get(target.id) ?? null);
    try {
      addJson(
        "compiled-model",
        JSON.parse(
          Buffer.from(
            currentGeneratedFile(
              project,
              `models/${encodeAutoMoviePathSegment(target.id)}.json`,
              context,
            ),
          ).toString("utf8"),
        ) as unknown,
      );
    } catch {
      addJson("compiled-model", null);
    }
    for (const frame of currentFrames(
      project,
      target,
      [],
      compileStatus!,
      context,
    ))
      addJson(
        `frame:${canonicalizeAutoMovieJson(frame.target)}:${frame.pass}`,
        frame,
      );
    fields.push(compilerField());
  } else if (target.kind === "design") {
    addJson("design", project.design(target.design));
    const addModelGraph = (
      role: string,
      modelId: string,
      seen: Set<string> = new Set(),
    ): void => {
      if (seen.has(modelId)) return;
      seen.add(modelId);
      const model = graph.models.get(modelId) ?? null;
      addJson(`${role}:${modelId}`, model);
      if (model !== null)
        for (const lod of model.lod)
          if (lod.recipe !== modelId) addModelGraph(role, lod.recipe, seen);
    };
    if (target.design.kind === "model") {
      for (const lod of graph.models.get(target.design.id)?.lod ?? [])
        if (lod.recipe !== target.design.id)
          addModelGraph("dependency:model", lod.recipe);
    } else if (target.design.kind === "formation") {
      const formation = graph.formations.get(target.design.id);
      addModelGraph("dependency:model", formation?.modelRecipe ?? "");
    } else if (target.design.kind === "shot") {
      const shot = graph.shots.get(target.design.id);
      addJson("dependency:production", graph.production);
      addJson("dependency:world", graph.world);
      for (const participant of shot?.participants ?? [])
        if (participant.kind === "formation") {
          const formation = graph.formations.get(participant.id) ?? null;
          addJson(`dependency:formation:${participant.id}`, formation);
          if (formation !== null)
            addModelGraph("dependency:model", formation.modelRecipe);
        } else addModelGraph("dependency:model", participant.id);
    }
    if (target.design.kind === "acceptance") {
      const acceptance = graph.acceptance.get(target.design.id);
      if (acceptance?.target.kind === "shot")
        addJson(
          `dependency:shot:${acceptance.target.id}`,
          graph.shots.get(acceptance.target.id) ?? null,
        );
      else if (acceptance?.target.kind === "film")
        addJson("dependency:production", graph.production);
      if (acceptance !== undefined)
        for (const shot of acceptanceCriterionShots(acceptance))
          addJson(
            `dependency:criterion-shot:${shot}`,
            graph.shots.get(shot) ?? null,
          );
    }
  } else if (target.kind === "source") {
    addSourceField(fields, project, target.path);
    for (const [id, shot] of graph.shots)
      if (shot.source.module === target.path) addJson(`binding:${id}`, shot);
    fields.push(compilerField());
  } else if (target.kind === "shot") {
    const shot = graph.shots.get(target.id) ?? null;
    addJson("shot-contract", shot);
    if (shot !== null) addSourceField(fields, project, shot.source.module);
    for (const [id, acceptance] of graph.acceptance)
      if (acceptanceAddressesShot(acceptance, target.id))
        addJson(`acceptance:${id}`, acceptance);
    const generated = currentGeneratedManifest(project, context);
    addJson(
      "render-target",
      generated === null
        ? null
        : currentRenderTargetFingerprint(project, generated, target, context),
    );
    for (const frame of currentFrames(
      project,
      target,
      [],
      compileStatus!,
      context,
    ))
      addJson(`frame:${frame.bundle}:${frame.frame}:${frame.pass}`, frame);
    for (const outcome of currentAcceptanceOutcomes(
      project,
      target,
      [],
      compileStatus!,
      context,
    ))
      addJson(`outcome:${outcome.scenario}`, outcome);
    fields.push(compilerField());
  } else if (target.kind === "rendition") {
    const shotTarget: IAutoMovieReviewTarget = {
      kind: "shot",
      id: target.id,
    };
    addJson("shot-contract", graph.shots.get(target.id) ?? null);
    fields.push({
      role: "source-shot-current",
      kind: "digest",
      payload: Buffer.from(
        reviewFingerprint(project, shotTarget, compileStatus!, context),
        "utf8",
      ),
    });
    addJson("source-shot-review", project.review(shotTarget));
    for (const rendition of currentRenditions(project, target, [], context))
      addJson(`rendition:${rendition.path}`, rendition);
    fields.push(compilerField());
  } else if (target.kind === "sequence") {
    const sequence = project
      .screenplayIndex()
      ?.treatment.sequences.find((item) => item.id === target.id);
    addJson("sequence", sequence ?? null);
    addJson(
      "compile-current",
      currentCompileInput === undefined
        ? compileStatus!.compiler.inputFingerprint
        : currentCompileInput,
    );
    const shotIds = sequenceShotIds(project, target.id);
    for (const id of shotIds) {
      const shotTarget: IAutoMovieReviewTarget = { kind: "shot", id };
      fields.push({
        role: `shot-current:${id}`,
        kind: "digest",
        payload: Buffer.from(
          reviewFingerprint(project, shotTarget, compileStatus!, context),
          "utf8",
        ),
      });
      addJson(`shot-review:${id}`, project.review(shotTarget));
      if (graph.production?.visualDelivery === "repainted") {
        const renditionTarget: IAutoMovieReviewTarget = {
          kind: "rendition",
          id,
        };
        fields.push({
          role: `rendition-current:${id}`,
          kind: "digest",
          payload: Buffer.from(
            reviewFingerprint(
              project,
              renditionTarget,
              compileStatus!,
              context,
            ),
            "utf8",
          ),
        });
        addJson(`rendition-review:${id}`, project.review(renditionTarget));
      }
    }
    for (const rendition of currentRenditions(project, target, [], context))
      addJson(`rendition:${rendition.path}`, rendition);
    for (const frame of currentFrames(
      project,
      target,
      [],
      compileStatus!,
      context,
    ))
      addJson(
        `frame:${canonicalizeAutoMovieJson(frame.target)}:${frame.frame}:${frame.pass}`,
        frame,
      );
    fields.push(compilerField());
  } else {
    addJson("production", graph.production);
    addJson(
      "compile-current",
      currentCompileInput === undefined
        ? compileStatus!.compiler.inputFingerprint
        : currentCompileInput,
    );
    try {
      addJson(
        "film-timeline",
        JSON.parse(
          Buffer.from(
            currentGeneratedFile(project, "film-timeline.json", context),
          ).toString("utf8"),
        ) as unknown,
      );
    } catch {
      addJson("film-timeline", null);
    }
    for (const [id, acceptance] of graph.acceptance)
      addJson(`acceptance:${id}`, acceptance);
    for (const [id] of graph.shots) {
      const shotTarget: IAutoMovieReviewTarget = { kind: "shot", id };
      fields.push({
        role: `shot-current:${id}`,
        kind: "digest",
        payload: Buffer.from(
          reviewFingerprint(project, shotTarget, compileStatus!, context),
          "utf8",
        ),
      });
      addJson(`shot-review:${id}`, project.review(shotTarget));
      if (graph.production?.visualDelivery === "repainted") {
        const renditionTarget: IAutoMovieReviewTarget = {
          kind: "rendition",
          id,
        };
        fields.push({
          role: `rendition-current:${id}`,
          kind: "digest",
          payload: Buffer.from(
            reviewFingerprint(
              project,
              renditionTarget,
              compileStatus!,
              context,
            ),
            "utf8",
          ),
        });
        addJson(`rendition-review:${id}`, project.review(renditionTarget));
      }
    }
    for (const sequence of project.screenplayIndex()?.treatment.sequences ??
      []) {
      if (sequenceShotIds(project, sequence.id).length === 0) continue;
      const sequenceTarget: IAutoMovieReviewTarget = {
        kind: "sequence",
        id: sequence.id,
      };
      fields.push({
        role: `sequence-current:${sequence.id}`,
        kind: "digest",
        payload: Buffer.from(
          reviewFingerprint(project, sequenceTarget, compileStatus!, context),
          "utf8",
        ),
      });
      addJson(`sequence-review:${sequence.id}`, project.review(sequenceTarget));
    }
    for (const rendition of currentRenditions(project, target, [], context))
      addJson(`rendition:${rendition.path}`, rendition);
    // Terminal deliverable bytes, manifest and parser receipt are published
    // after the review snapshot under one final compiler fence. They are
    // compiler-owned delivery evidence, not human/agent review input; binding
    // the film fingerprint to that later publication makes the required
    // review-current -> publish ordering invalidate itself. Film review remains
    // bound to the exact timeline, shot reviews, PNG frames and acceptance
    // outcomes below, while final compilation validates terminal media.
    for (const frame of currentFrames(
      project,
      target,
      [],
      compileStatus!,
      context,
    ))
      addJson(`frame:${frame.bundle}:${frame.frame}:${frame.pass}`, frame);
    for (const outcome of currentAcceptanceOutcomes(
      project,
      target,
      [],
      compileStatus!,
      context,
    ))
      addJson(`outcome:${outcome.scenario}`, outcome);
  }
  const fingerprint = fingerprintAutoMovieFields(fields);
  context?.fingerprints.set(targetKey, fingerprint);
  return fingerprint;
};

const addSourceField = (
  fields: IAutoMovieFingerprintField[],
  project: AutoMovieProductionProject,
  sourcePath: string,
): void => {
  try {
    fields.push({
      role: `source:${sourcePath}`,
      kind: "typescript",
      payload: normalizeAutoMovieSource(project.readSource(sourcePath)),
    });
  } catch {
    fields.push({
      role: `source:${sourcePath}`,
      kind: "absent",
      payload: new Uint8Array(),
    });
  }
};

const compilerField = (): IAutoMovieFingerprintField => ({
  role: "compiler",
  kind: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
  payload: Buffer.from(AUTOMOVIE_PRODUCTION_COMPILER_VERSION, "utf8"),
});

const reviewTargets = (
  project: AutoMovieProductionProject,
  context?: IReviewReadContext,
): IAutoMovieReviewTarget[] => {
  const graph = project.graph();
  const targets: IAutoMovieReviewTarget[] = [];
  if (graph.production !== null)
    targets.push({
      kind: "design",
      design: { kind: "production" },
    });
  for (const id of consumedModelIds(project, context))
    targets.push({ kind: "asset", id });
  if (graph.world !== null)
    targets.push({ kind: "design", design: { kind: "world" } });
  for (const id of graph.formations.keys())
    targets.push({ kind: "design", design: { kind: "formation", id } });
  for (const [id, shot] of graph.shots) {
    targets.push({ kind: "design", design: { kind: "shot", id } });
    targets.push({ kind: "source", path: shot.source.module });
    targets.push({ kind: "shot", id });
    if (graph.production?.visualDelivery === "repainted")
      targets.push({ kind: "rendition", id });
  }
  for (const [id, acceptance] of graph.acceptance)
    if (acceptance.required)
      targets.push({ kind: "design", design: { kind: "acceptance", id } });
  for (const sequence of project.screenplayIndex()?.treatment.sequences ?? [])
    if (sequenceShotIds(project, sequence.id).length !== 0)
      targets.push({ kind: "sequence", id: sequence.id });
  if (graph.production !== null)
    targets.push({ kind: "film", id: graph.production.id });
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = reviewTargetKey(target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const consumedModelIds = (
  project: AutoMovieProductionProject,
  context?: IReviewReadContext,
): string[] => {
  const generated = currentGeneratedManifest(project, context);
  const graph = project.graph();
  const models = new Set<string>();
  const addModel = (id: string): void => {
    if (models.has(id)) return;
    const recipe = graph.models.get(id);
    if (recipe === undefined) return;
    models.add(id);
    for (const lod of recipe.lod) addModel(lod.recipe);
  };
  for (const shot of graph.shots.values())
    for (const participant of shot.participants)
      if (participant.kind === "actor") addModel(participant.id);
      else {
        const formation = graph.formations.get(participant.id);
        if (formation !== undefined) addModel(formation.modelRecipe);
      }
  if (generated !== null)
    for (const entry of generated.files)
      if (entry.path.startsWith("shots/"))
        try {
          const validation = typia.validateEquals<IAutoMovieCompiledShotSource>(
            JSON.parse(
              Buffer.from(
                currentGeneratedFile(project, entry.path, context),
              ).toString("utf8"),
            ) as unknown,
          );
          if (validation.success)
            for (const model of validation.data.models) addModel(model.id);
        } catch {
          // Invalid generated shot bytes are already compiler diagnostics.
        }
  return [...models].sort(compareCodeUnits);
};

const sequenceShotIds = (
  project: AutoMovieProductionProject,
  sequenceId: string,
): string[] => {
  const index = project.screenplayIndex();
  const sequence = index?.treatment.sequences.find(
    (candidate) => candidate.id === sequenceId,
  );
  if (index === null || index === undefined || sequence === undefined)
    return [];
  const beats = new Set(sequence.beats.map((beat) => beat.text));
  const scenes = new Set(
    index.screenplay.scenes
      .filter(
        (scene) =>
          scene.status === "active" &&
          scene.covers.some((coverage) => beats.has(coverage.beat)),
      )
      .map((scene) => scene.id),
  );
  return [...project.graph().shots]
    .filter(([, shot]) =>
      (shot.evidence ?? []).some((evidence) => scenes.has(evidence.scene)),
    )
    .map(([id]) => id)
    .sort(compareCodeUnits);
};

const currentAcceptanceOutcomes = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  diagnostics: IAutoMovieDiagnostic[],
  compileStatus: IAutoMovieCompileProjectOutput,
  context?: IReviewReadContext,
): IAutoMovieAcceptanceOutcomeReference[] => {
  if (
    target.kind !== "shot" &&
    target.kind !== "sequence" &&
    target.kind !== "film"
  )
    return [];
  const generated = currentGeneratedManifest(project, context);
  const graph = project.graph();
  const sequenceShots =
    target.kind === "sequence"
      ? new Set(sequenceShotIds(project, target.id))
      : undefined;
  const scenarios = [...graph.acceptance.values()]
    .filter(
      (scenario) =>
        scenario.required &&
        (target.kind === "film" ||
          (target.kind === "sequence" &&
            [...(sequenceShots ?? [])].some((shot) =>
              acceptanceAddressesShot(scenario, shot),
            )) ||
          acceptanceAddressesShot(scenario, target.id)),
    )
    .sort((left, right) => compareCodeUnits(left.id, right.id));
  // Absent, stale or tampered compiler output cannot settle any acceptance
  // scenario. Returning an empty list alone would remove every required
  // scenario from the prepared review without saying so, which is the shape a
  // submission carrying no acceptance evidence needs to look complete. Report
  // each one instead.
  if (
    generated === null ||
    compileStatus.success === false ||
    compileStatus.compiler.inputFingerprint !== generated.inputFingerprint
  ) {
    for (const scenario of scenarios)
      diagnostics.push(
        outcomeMissingDiagnostic(
          target,
          scenario.id,
          "Compiler-owned output is absent or not current, so no acceptance outcome can be derived. Compile the project, then prepare this review again.",
        ),
      );
    return [];
  }
  const compiled = new Map<string, IAutoMovieCompiledShotSource>();
  const realizations = new Map<string, IAutoMovieCompiledContractRealization>();
  let retainedTimeline: IAutoMovieFilmTimeline | null | undefined;
  const readTimeline = (): IAutoMovieFilmTimeline | null => {
    if (retainedTimeline !== undefined) return retainedTimeline;
    try {
      retainedTimeline = currentFilmTimeline(
        project,
        generated.inputFingerprint,
        context,
      );
    } catch {
      retainedTimeline = null;
    }
    return retainedTimeline;
  };
  const readCompiled = (shot: string): IAutoMovieCompiledShotSource | null => {
    const retained = compiled.get(shot);
    if (retained !== undefined) return retained;
    try {
      const validation = typia.validateEquals<IAutoMovieCompiledShotSource>(
        JSON.parse(
          Buffer.from(
            currentGeneratedFile(
              project,
              `shots/${encodeAutoMoviePathSegment(shot)}.json`,
              context,
            ),
          ).toString("utf8"),
        ) as unknown,
      );
      if (validation.success === false) return null;
      compiled.set(shot, validation.data);
      return validation.data;
    } catch {
      return null;
    }
  };
  const readRealization = (
    shot: string,
  ): IAutoMovieCompiledContractRealization | null => {
    const retained = realizations.get(shot);
    if (retained !== undefined) return retained;
    try {
      const validation =
        typia.validateEquals<IAutoMovieCompiledContractRealization>(
          JSON.parse(
            Buffer.from(
              currentGeneratedFile(
                project,
                `realizations/${encodeAutoMoviePathSegment(shot)}.json`,
                context,
              ),
            ).toString("utf8"),
          ) as unknown,
        );
      if (validation.success === false) return null;
      realizations.set(shot, validation.data);
      return validation.data;
    } catch {
      return null;
    }
  };
  const outcomes: IAutoMovieAcceptanceOutcomeReference[] = [];
  for (const scenario of scenarios) {
    const criterion = scenario.criterion;
    if (
      target.kind === "film" &&
      criterion.kind !== "event" &&
      acceptanceBelongsToFilm(graph, scenario, readTimeline()) === false
    )
      continue;
    if (criterion.kind === "frame") continue;
    if (criterion.kind === "event") {
      const shot =
        criterion.shot ??
        (scenario.target.kind === "shot" ? scenario.target.id : undefined);
      const event =
        shot === undefined
          ? undefined
          : readRealization(shot)?.events.find(
              (candidate) => candidate.id === criterion.event,
            );
      if (
        target.kind === "film" &&
        acceptanceBelongsToFilm(
          graph,
          scenario,
          readTimeline(),
          event?.time,
        ) === false
      )
        continue;
      if (shot === undefined || event === undefined) {
        diagnostics.push(
          outcomeMissingDiagnostic(
            target,
            scenario.id,
            `Compiler-derived event "${criterion.event}" is absent. Recompile the owning shot before review.`,
          ),
        );
        continue;
      }
      outcomes.push({
        kind: "event",
        scenario: scenario.id,
        shot,
        event: criterion.event,
        realization: event,
        passed: event.passed,
      });
      continue;
    }
    if (criterion.kind === "story-sync") {
      // The claim spans shots, so it is measured over the realizations the
      // per-shot event outcomes already read. A missing realization leaves the
      // outcome unresolved rather than absent, which keeps the reviewer looking
      // at the failure instead of at nothing.
      outcomes.push({
        kind: "story-sync",
        scenario: scenario.id,
        ...autoMovieStorySyncOutcome({
          criterion,
          contracts: graph.shots,
          realization: readRealization,
        }),
      });
      continue;
    }
    const fps = graph.production!.frameFormat.fps;
    const filmFrames =
      scenario.target.kind === "film" ? readTimeline()?.totalFrames : null;
    const actual =
      scenario.target.kind === "shot"
        ? readCompiled(scenario.target.id)?.shot.duration
        : filmFrames === null || filmFrames === undefined
          ? null
          : filmFrames / fps;
    if (actual === undefined || actual === null) {
      diagnostics.push(
        outcomeMissingDiagnostic(
          target,
          scenario.id,
          "Compiler-derived runtime is unavailable. Recompile every addressed shot before review.",
        ),
      );
      continue;
    }
    outcomes.push({
      kind: "metric",
      scenario: scenario.id,
      metric: criterion.metric,
      actual,
      operator: criterion.operator,
      expected: criterion.value,
      passed:
        criterion.operator === "=="
          ? frameClockClose(actual, criterion.value)
          : criterion.operator === "<="
            ? actual <= criterion.value
            : actual >= criterion.value,
    });
  }
  return outcomes;
};

const outcomeMissingDiagnostic = (
  target: IAutoMovieReviewTarget,
  scenario: string,
  message: string,
): IAutoMovieDiagnostic => ({
  code: "review-outcome-missing",
  category: "error",
  phase: "review",
  target: reviewTargetKey(target),
  path: null,
  message: `Required acceptance "${scenario}": ${message}`,
});

const acceptanceBelongsToFilm = (
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
  scenario: IAutoMovieAcceptanceScenario,
  timeline: IAutoMovieFilmTimeline | null,
  eventTime?: number,
): boolean => {
  if (timeline === null) return true;
  if (scenario.target.kind === "film" && scenario.criterion.kind === "metric")
    return true;
  const shot =
    (scenario.criterion.kind === "frame" ||
      scenario.criterion.kind === "event") &&
    scenario.criterion.shot !== undefined
      ? scenario.criterion.shot
      : scenario.target.kind === "shot"
        ? scenario.target.id
        : null;
  if (shot === null) return true;
  const segment = timeline.segments.find(
    (candidate) => candidate.shot === shot,
  );
  if (segment === undefined) return false;
  if (scenario.criterion.kind === "frame") {
    const criterion = scenario.criterion;
    const residentShot = graph.shots.get(shot);
    if (residentShot === undefined) return false;
    const frame = residentShot.reviewFrames.find(
      (candidate) => candidate.id === criterion.frame,
    );
    if (frame === undefined) return true;
    const index = Math.round(frame.time * timeline.fps);
    return index >= segment.sourceInFrame && index < segment.sourceOutFrame;
  }
  if (scenario.criterion.kind === "event") {
    if (eventTime === undefined) return true;
    const frame = Math.round(eventTime * timeline.fps);
    return frame >= segment.sourceInFrame && frame < segment.sourceOutFrame;
  }
  return true;
};

const currentAcceptanceEventTime = (
  project: AutoMovieProductionProject,
  scenario: IAutoMovieAcceptanceScenario,
): number | undefined => {
  if (scenario.criterion.kind !== "event") return undefined;
  const shot =
    scenario.criterion.shot ??
    (scenario.target.kind === "shot" ? scenario.target.id : undefined);
  if (shot === undefined) return undefined;
  const eventId = scenario.criterion.event;
  try {
    const validation =
      typia.validateEquals<IAutoMovieCompiledContractRealization>(
        JSON.parse(
          Buffer.from(
            project.readGeneratedFile(
              `realizations/${encodeAutoMoviePathSegment(shot)}.json`,
            ),
          ).toString("utf8"),
        ) as unknown,
      );
    return validation.success
      ? validation.data.events.find((event) => event.id === eventId)?.time
      : undefined;
  } catch {
    return undefined;
  }
};

interface IRequiredAssetReviewView {
  id: string;
  angleDeg: number;
  elevationDeg: number;
  pose: "rest" | "rom-extremes";
  pass: IAutoMovieFrameEvidenceReference["pass"];
}

const currentAssetFrames = (
  project: AutoMovieProductionProject,
  target: Extract<IAutoMovieReviewTarget, { kind: "asset" }>,
  diagnostics: IAutoMovieDiagnostic[],
  compileStatus: IAutoMovieCompileProjectOutput,
  context?: IReviewReadContext,
): IAutoMovieFrameEvidenceReference[] => {
  const generated = currentGeneratedManifest(project, context);
  const production = project.graph().production;
  if (generated === null || production === null) return [];
  if (
    compileStatus.success === false ||
    compileStatus.compiler.inputFingerprint !== generated.inputFingerprint
  ) {
    diagnostics.push({
      code: "review-evidence-stale",
      category: "error",
      phase: "review",
      target: reviewTargetKey(target),
      path: null,
      message:
        "Generated model output is not a clean compile of current design and source. Compile the project before capturing asset review evidence.",
    });
    return [];
  }
  let model: IAutoMovieModel;
  try {
    const validation = typia.validateEquals<IAutoMovieModel>(
      JSON.parse(
        Buffer.from(
          currentGeneratedFile(
            project,
            `models/${encodeAutoMoviePathSegment(target.id)}.json`,
            context,
          ),
        ).toString("utf8"),
      ) as unknown,
    );
    if (validation.success === false)
      throw new Error("compiled model has an invalid schema");
    model = validation.data;
  } catch (error) {
    diagnostics.push({
      code: "review-evidence-stale",
      category: "error",
      phase: "review",
      target: reviewTargetKey(target),
      path: targetPath(project, target),
      message: `Current compiler-owned model is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }. Compile the consumed model before asset review.`,
    });
    return [];
  }
  const required: IRequiredAssetReviewView[] = [
    {
      id: "turntable-front",
      angleDeg: 0,
      elevationDeg: 15,
      pose: "rest",
      pass: "beauty",
    },
    {
      id: "turntable-right",
      angleDeg: 90,
      elevationDeg: 15,
      pose: "rest",
      pass: "beauty",
    },
    {
      id: "turntable-back",
      angleDeg: 180,
      elevationDeg: 15,
      pose: "rest",
      pass: "beauty",
    },
    {
      id: "turntable-left",
      angleDeg: 270,
      elevationDeg: 15,
      pose: "rest",
      pass: "beauty",
    },
    {
      id: "top-outline",
      angleDeg: 0,
      elevationDeg: 65,
      pose: "rest",
      pass: "outline",
    },
    ...(model.skeleton === null
      ? []
      : [
          {
            id: "rig-rom-extremes",
            angleDeg: 0,
            elevationDeg: 15,
            pose: "rom-extremes" as const,
            pass: "beauty" as const,
          },
        ]),
  ];
  const covered = new Set<string>();
  const frames: IAutoMovieFrameEvidenceReference[] = [];
  const inventory =
    context?.renderInventory ?? collectRenderManifestInventory(project);
  appendInvalidRenderManifestDiagnostics(
    project,
    diagnostics,
    inventory.invalid,
  );
  const entries = inventory.all
    .filter(
      (entry) =>
        entry.manifest.target.kind === "asset" &&
        entry.manifest.target.id === target.id,
    )
    .sort((left, right) => compareCodeUnits(left.path, right.path));
  for (const entry of entries) {
    const manifest = project.verifiedRenderManifest(entry.path);
    if (manifest === null || manifest.target.kind !== "asset") continue;
    const manifestTarget = manifest.target;
    const requirement = required.find(
      (item) =>
        item.angleDeg === manifestTarget.angleDeg &&
        item.elevationDeg === manifestTarget.elevationDeg &&
        item.pose === manifestTarget.pose &&
        covered.has(item.id) === false,
    );
    if (requirement === undefined) continue;
    if (
      manifest.targetFingerprint !==
      currentRenderTargetFingerprint(
        project,
        generated,
        manifest.target,
        context,
      )
    )
      continue;
    const bundleRoot = path.dirname(entry.path);
    const bundle = normalizeSlash(path.relative(project.root, bundleRoot));
    if (
      manifest.renderSpec.target !== manifest.target.id ||
      manifest.renderSpec.frameFormat.fps !== production.frameFormat.fps ||
      manifest.renderSpec.frameFormat.width !== production.frameFormat.width ||
      manifest.renderSpec.frameFormat.height !== production.frameFormat.height
    ) {
      diagnostics.push({
        code: "render-frame-invalid",
        category: "warning",
        phase: "render",
        target: bundle,
        path: normalizeSlash(path.relative(project.root, entry.path)),
        message:
          "This asset view does not match the current asset, production FPS, and exact production raster, so it cannot discharge review. Capture the required view again without width/height overrides before submitReview.",
      });
      continue;
    }
    const expectedIndex = Math.round(
      (requirement.angleDeg / 30) * production.frameFormat.fps,
    );
    const frame = manifest.frames.find(
      (candidate) =>
        candidate.index === expectedIndex &&
        candidate.pass === requirement.pass,
    );
    if (frame === undefined) continue;
    let file = path.join(bundleRoot, frame.path);
    try {
      file = resolveInside(bundleRoot, frame.path);
      const realBundleRoot = fs.realpathSync(bundleRoot);
      const realFile = fs.realpathSync(file);
      if (isInside(realBundleRoot, realFile) === false)
        throw new Error("frame escapes its bundle through a symlink");
      const bytes = project.readRenderFile(
        normalizeSlash(path.relative(project.renderRoot(), file)),
      );
      if (digestAutoMovieBytes(bytes) !== frame.digest)
        throw new Error("frame bytes changed after ownership verification");
      const png = PNG.sync.read(Buffer.from(bytes));
      const expectedTime = frame.index / production.frameFormat.fps;
      if (
        png.width !== production.frameFormat.width ||
        png.height !== production.frameFormat.height ||
        hasVisiblePixelVariance(png) === false ||
        frameClockClose(frame.time, expectedTime) === false
      )
        throw new Error(
          "production dimensions, visible pixels, or frame clock do not match",
        );
      frames.push({
        target: manifest.target,
        reviewFrame: requirement.id,
        bundle,
        frame: frame.index,
        time: frame.time,
        pass: frame.pass,
        digest: frame.digest,
        width: png.width,
        height: png.height,
      });
      covered.add(requirement.id);
    } catch (error) {
      diagnostics.push({
        code: "render-frame-invalid",
        category: "error",
        phase: "render",
        target: `${bundle}:${frame.index}:${frame.pass}`,
        path: normalizeSlash(path.relative(project.root, file)),
        message: `${
          error instanceof Error ? error.message : String(error)
        }. Recreate this asset view through captureFrame.`,
      });
    }
  }
  for (const requirement of required)
    if (covered.has(requirement.id) === false)
      diagnostics.push({
        code: "review-evidence-missing",
        category: "error",
        phase: "review",
        target: `${reviewTargetKey(target)}:${requirement.id}`,
        path: null,
        message: `Required asset view "${requirement.id}" has no current verified PNG. Call captureFrame with {target:{kind:"asset", id:"${target.id}", angleDeg:${requirement.angleDeg}, elevationDeg:${requirement.elevationDeg}, pose:"${requirement.pose}", pass:"${requirement.pass}"}} at the exact production raster.`,
      });
  return frames.sort((left, right) =>
    compareCodeUnits(left.reviewFrame, right.reviewFrame),
  );
};

const currentRenditions = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  diagnostics: IAutoMovieDiagnostic[],
  context?: IReviewReadContext,
): IAutoMovieRenditionEvidenceReference[] => {
  const graph = project.graph();
  if (
    graph.production?.visualDelivery !== "repainted" ||
    (target.kind !== "rendition" &&
      target.kind !== "sequence" &&
      target.kind !== "film")
  )
    return [];
  let filmShots: string[] = [];
  if (target.kind === "film") {
    const generated = currentGeneratedManifest(project, context);
    if (generated !== null)
      try {
        filmShots = [
          ...new Set(
            currentFilmTimeline(
              project,
              generated.inputFingerprint,
              context,
            ).segments.map((segment) => segment.shot),
          ),
        ].sort(compareCodeUnits);
      } catch {}
  }
  const shotIds =
    target.kind === "rendition"
      ? [target.id]
      : target.kind === "sequence"
        ? sequenceShotIds(project, target.id)
        : filmShots;
  const required = new Set(shotIds);
  const missingInventory =
    context === undefined
      ? shotIds
      : shotIds.filter((shot) => context.repaintRenditions.has(shot) === false);
  const verified = project.verifiedRepaintRenditions(missingInventory);
  if (context !== undefined) {
    const byShot = new Map(verified.map((receipt) => [receipt.shot, receipt]));
    for (const shot of missingInventory)
      context.repaintRenditions.set(shot, byShot.get(shot) ?? null);
  }
  const inventory =
    context === undefined
      ? verified
      : shotIds.flatMap((shot) => {
          const receipt = context.repaintRenditions.get(shot);
          return receipt === undefined || receipt === null ? [] : [receipt];
        });
  const receipts = inventory.filter((receipt) => required.has(receipt.shot));
  const covered = new Set(receipts.map((receipt) => receipt.shot));
  for (const shot of shotIds)
    if (covered.has(shot) === false)
      diagnostics.push({
        code: "review-rendition-missing",
        category: "error",
        phase: "review",
        target: `${reviewTargetKey(target)}:${shot}`,
        path: null,
        message: `Production visualDelivery is "repainted", but shot "${shot}" has no current byte- and receipt-verified rendition. Run repaintShot for the current deterministic source, inspect its MP4, then prepare this review again.`,
      });
  return receipts.map((receipt) => ({
    shot: receipt.shot,
    path: receipt.output.path,
    digest: receipt.output.digest,
    receiptDigest: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(receipt)),
    sourceRenderFingerprint: receipt.sourceRenderFingerprint,
    sourceReviewFingerprint: receipt.sourceReviewFingerprint,
    controls: receipt.controls,
    references: receipt.references,
    adapterIdentity: receipt.adapterIdentity,
    parameters: receipt.parameters,
    probe: receipt.output.probe,
  }));
};

/** Surface cross-shot delivery incompatibility before a film can be approved. */
const appendRenditionDeliveryReviewDiagnostic = (
  diagnostics: IAutoMovieDiagnostic[],
  project: AutoMovieProductionProject,
  film: string,
  compileStatus: IAutoMovieCompileProjectOutput,
  renditions: readonly IAutoMovieRenditionEvidenceReference[],
  context?: IReviewReadContext,
): void => {
  const generated = currentGeneratedManifest(project, context);
  if (
    generated === null ||
    compileStatus.success === false ||
    compileStatus.compiler.inputFingerprint !== generated.inputFingerprint
  )
    return;
  try {
    const timeline = currentFilmTimeline(
      project,
      generated.inputFingerprint,
      context,
    );
    const shots = [
      ...new Set(timeline.segments.map((segment) => segment.shot)),
    ];
    const byShot = new Map(
      renditions.map((rendition) => [rendition.shot, rendition] as const),
    );
    if (shots.some((shot) => byShot.has(shot) === false)) return;
    assertProductionRenditionTimelineDelivery({
      timeline,
      clips: new Map(
        shots.map((shot) => {
          const rendition = byShot.get(shot)!;
          return [shot, project.readRenderFile(rendition.path)] as const;
        }),
      ),
    });
  } catch (error) {
    diagnostics.push({
      code: "review-rendition-delivery-invalid",
      category: "error",
      phase: "review",
      target: `film:${film}`,
      path: null,
      message: `${
        error instanceof Error ? error.message : String(error)
      } Correct the film edit or repaint clips before completing film review; final delivery never falls back to deterministic pixels.`,
    });
  }
};

const currentFrames = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  diagnostics: IAutoMovieDiagnostic[],
  compileStatus: IAutoMovieCompileProjectOutput,
  context?: IReviewReadContext,
): IAutoMovieFrameEvidenceReference[] => {
  if (target.kind === "asset")
    return currentAssetFrames(
      project,
      target,
      diagnostics,
      compileStatus,
      context,
    );
  if (
    target.kind !== "shot" &&
    target.kind !== "sequence" &&
    target.kind !== "film"
  )
    return [];
  const generated = currentGeneratedManifest(project, context);
  if (generated === null) return [];
  if (
    compileStatus.success === false ||
    compileStatus.compiler.inputFingerprint !== generated.inputFingerprint
  ) {
    const generatedManifestPath = normalizeSlash(
      path.relative(
        project.root,
        project.trackedStatePath("generated-manifest.json"),
      ),
    );
    diagnostics.push({
      code: "review-evidence-stale",
      category: "error",
      phase: "review",
      target: reviewTargetKey(target),
      path: generatedManifestPath,
      message:
        "Generated output is not a clean compile of current design and source. Run the scaffold compile command before using any frame as review evidence.",
    });
    return [];
  }
  const frames: IAutoMovieFrameEvidenceReference[] = [];
  const graph = project.graph();
  let timeline: IAutoMovieFilmTimeline | null = null;
  if (target.kind === "sequence" || target.kind === "film")
    try {
      timeline = currentFilmTimeline(
        project,
        generated.inputFingerprint,
        context,
      );
    } catch (error) {
      diagnostics.push({
        code: "review-evidence-stale",
        category: "error",
        phase: "review",
        target: reviewTargetKey(target),
        path: normalizeSlash(
          path.relative(
            project.root,
            path.join(project.generatedRoot(), "film-timeline.json"),
          ),
        ),
        message: `${
          error instanceof Error ? error.message : String(error)
        } Recompile before preparing ${target.kind} review.`,
      });
      return [];
    }
  const targetShots =
    target.kind === "sequence"
      ? new Set(sequenceShotIds(project, target.id))
      : undefined;
  const filmShots = new Set(
    (timeline?.segments ?? [])
      .map((segment) => segment.shot)
      .filter((shot) => targetShots === undefined || targetShots.has(shot)),
  );
  const required = requiredReviewFrames(
    graph,
    target,
    timeline,
    target.kind === "sequence" ? sequenceShotIds(project, target.id) : [],
  );
  const covered = new Set<string>();
  const inventory =
    context?.renderInventory ?? collectRenderManifestInventory(project);
  appendInvalidRenderManifestDiagnostics(
    project,
    diagnostics,
    inventory.invalid,
  );
  const legacyEntries =
    target.kind === "shot"
      ? inventory.legacy.filter(
          (entry) => reviewTargetKey(entry.target) === reviewTargetKey(target),
        )
      : inventory.legacy.filter(
          (entry) =>
            (entry.target.kind === "film" && entry.target.id === target.id) ||
            (entry.target.kind === "shot" && filmShots.has(entry.target.id)),
        );
  for (const entry of legacyEntries)
    diagnostics.push({
      code: "render-bundle-legacy",
      category: "warning",
      phase: "render",
      target: normalizeSlash(path.relative(project.root, entry.path)),
      path: normalizeSlash(path.relative(project.root, entry.path)),
      message:
        "This legacy v2 render bundle is retained as historical output but is not current review evidence. Recapture required frames through captureFrame; a current v3 bundle supersedes this warning without deleting history.",
    });
  const manifestEntries =
    target.kind === "shot"
      ? (inventory.byTarget.get(reviewTargetKey(target)) ?? [])
      : inventory.all.filter(
          (entry) =>
            (entry.manifest?.target.kind === "film" &&
              entry.manifest.target.id === target.id) ||
            (entry.manifest?.target.kind === "shot" &&
              filmShots.has(entry.manifest.target.id)),
        );
  for (const entry of manifestEntries) {
    const manifestPath = entry.path;
    const manifest = project.verifiedRenderManifest(manifestPath);
    const bundleRoot = path.dirname(manifestPath);
    const bundle = normalizeSlash(path.relative(project.root, bundleRoot));
    if (manifest === null) {
      diagnostics.push({
        code: "render-bundle-unowned",
        category: "error",
        phase: "render",
        target: bundle,
        path: normalizeSlash(path.relative(project.root, manifestPath)),
        message:
          "This manifest is not at the canonical content-addressed path or lacks the matching MCP render receipt. Recreate it through captureFrame.",
      });
      continue;
    }
    if (
      manifest.targetFingerprint !==
      currentRenderTargetFingerprint(
        project,
        generated,
        manifest.target,
        context,
      )
    )
      continue;
    if (
      manifest.renderSpec.target !== manifest.target.id ||
      manifest.renderSpec.frameFormat.fps !==
        graph.production!.frameFormat.fps ||
      manifest.renderSpec.frameFormat.width !==
        graph.production!.frameFormat.width ||
      manifest.renderSpec.frameFormat.height !==
        graph.production!.frameFormat.height
    ) {
      diagnostics.push({
        code: "render-frame-invalid",
        category: "warning",
        phase: "render",
        target: bundle,
        path: normalizeSlash(path.relative(project.root, manifestPath)),
        message:
          "This iteration frame does not match the current shot, production FPS, and exact production raster, so it cannot discharge review. Small preview thumbnails remain usable for diagnosis; capture each required frame again without width/height overrides before submitReview.",
      });
      continue;
    }
    for (const frame of manifest.frames) {
      let file = path.join(bundleRoot, frame.path);
      try {
        file = resolveInside(bundleRoot, frame.path);
        const realBundleRoot = fs.realpathSync(bundleRoot);
        const realFile = fs.realpathSync(file);
        if (isInside(realBundleRoot, realFile) === false)
          throw new Error("frame escapes its bundle through a symlink");
        const bytes = project.readRenderFile(
          normalizeSlash(path.relative(project.renderRoot(), file)),
        );
        const digest = digestAutoMovieBytes(bytes);
        if (digest !== frame.digest)
          throw new Error(
            "frame bytes changed after renderer ownership verification",
          );
        const png = PNG.sync.read(Buffer.from(bytes));
        const expectedTime = frame.index / manifest.renderSpec.frameFormat.fps;
        if (
          frame.width !== manifest.renderSpec.frameFormat.width ||
          frame.height !== manifest.renderSpec.frameFormat.height ||
          hasVisiblePixelVariance(png) === false ||
          isProductionFrameTime(
            frame.time,
            manifest.renderSpec.frameFormat.fps,
          ) === false ||
          frameClockClose(frame.time, expectedTime) === false
        )
          throw new Error(
            "production dimensions, visible pixels, or frame clock do not match",
          );
        const requirements =
          manifest.target.kind === "shot"
            ? required.filter(
                (item) =>
                  item.shot === manifest.target.id &&
                  item.index === frame.index &&
                  item.pass === frame.pass,
              )
            : [];
        for (const requirement of requirements) {
          frames.push({
            target: { kind: "shot", id: requirement.shot },
            reviewFrame: requirement.frame,
            bundle,
            frame: frame.index,
            time: frame.time,
            pass: frame.pass,
            digest,
            width: png.width,
            height: png.height,
          });
          covered.add(
            reviewFrameKey(
              requirement.shot,
              requirement.frame,
              frame.index,
              frame.pass,
            ),
          );
        }
      } catch (error) {
        diagnostics.push({
          code: "render-frame-invalid",
          category: "error",
          phase: "render",
          target: `${bundle}:${frame.index}:${frame.pass}`,
          path: normalizeSlash(path.relative(project.root, file)),
          message: `${
            error instanceof Error ? error.message : String(error)
          }. Recreate this frame through captureFrame.`,
        });
      }
    }
  }
  for (const requirement of required)
    if (
      covered.has(
        reviewFrameKey(
          requirement.shot,
          requirement.frame,
          requirement.index,
          requirement.pass,
        ),
      ) === false
    )
      diagnostics.push({
        code: "review-evidence-missing",
        category: "error",
        phase: "review",
        target: `${requirement.shot}:${requirement.frame}:${requirement.pass}`,
        path: null,
        message: `Required review frame "${requirement.frame}" for shot "${requirement.shot}" at ${requirement.time}s pass "${requirement.pass}" has no current verified PNG. Call captureFrame for that exact production, shot, time, and pass.`,
      });
  return frames.sort(
    (left, right) =>
      compareCodeUnits(left.bundle, right.bundle) ||
      left.frame - right.frame ||
      compareCodeUnits(left.pass, right.pass) ||
      compareCodeUnits(left.reviewFrame, right.reviewFrame),
  );
};

interface IRequiredReviewFrame {
  shot: string;
  frame: string;
  time: number;
  index: number;
  pass: IAutoMovieFrameEvidenceReference["pass"];
}

const requiredReviewFrames = (
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
  target: Extract<
    IAutoMovieReviewTarget,
    { kind: "shot" | "sequence" | "film" }
  >,
  timeline: IAutoMovieFilmTimeline | null,
  sequenceShots: readonly string[] = [],
): IRequiredReviewFrame[] => {
  // currentFrames reaches this helper only after a clean compile, whose design
  // gate requires production metadata.
  const fps = graph.production!.frameFormat.fps;
  const segments = new Map(
    timeline?.segments.map((segment) => [segment.shot, segment]) ?? [],
  );
  const shots =
    target.kind === "shot"
      ? [[target.id, graph.shots.get(target.id)] as const]
      : [...segments.keys()]
          .filter(
            (shot) =>
              target.kind !== "sequence" || sequenceShots.includes(shot),
          )
          .map((shot) => [shot, graph.shots.get(shot)] as const);
  return shots.flatMap(([shotId, shot]) =>
    (shot === undefined
      ? []
      : target.kind === "film" || target.kind === "sequence"
        ? selectAutoMovieFilmReviewFrames(segments.get(shotId)!, shot, fps)
        : shot.reviewFrames.map((frame) => ({
            ...frame,
            index: Math.round(frame.time * fps),
          }))
    ).flatMap((frame) =>
      frame.passes.map((pass) => ({
        shot: shotId,
        frame: frame.id,
        time: frame.time,
        index: frame.index,
        pass,
      })),
    ),
  );
};

const reviewFrameKey = (
  shot: string,
  reviewFrame: string,
  index: number,
  pass: IAutoMovieFrameEvidenceReference["pass"],
): string => `${shot}\0${reviewFrame}\0${index}\0${pass}`;

const frameClockClose = (left: number, right: number): boolean =>
  Math.abs(left - right) <=
  Number.EPSILON * 64 * Math.max(1, Math.abs(left), Math.abs(right));

const jsonPointers = (
  value: unknown,
  target: IAutoMovieDesignTarget,
): IAutoMoviePrepareReviewOutput["quotable"] => {
  const pointers: string[] = [];
  const visit = (current: unknown, pointer: string): void => {
    if (pointers.length >= 256) return;
    pointers.push(pointer);
    if (Array.isArray(current))
      current.forEach((child, index) => visit(child, `${pointer}/${index}`));
    else if (typeof current === "object" && current !== null)
      for (const key of Object.keys(current as Record<string, unknown>).sort(
        compareCodeUnits,
      ))
        visit(
          (current as Record<string, unknown>)[key],
          `${pointer}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`,
        );
  };
  visit(value, "");
  return pointers.map((pointer) => ({ kind: "design", target, pointer }));
};

const sourceSelectors = (
  project: AutoMovieProductionProject,
  sourcePath: string,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMoviePrepareReviewOutput["quotable"] => {
  try {
    const lines = Buffer.from(
      normalizeAutoMovieSource(project.readSource(sourcePath)),
    )
      .toString("utf8")
      .split("\n");
    const selectors = lines.flatMap((line, index) =>
      line.trim().length === 0
        ? []
        : [{ kind: "source" as const, path: sourcePath, line: index + 1 }],
    );
    if (selectors.length > 512)
      diagnostics.push({
        code: "review-selector-truncated",
        category: "warning",
        phase: "review",
        target: `source:${sourcePath}`,
        path: sourcePath,
        message:
          "Source has more than 512 non-blank lines; prepareReview returns the first 512 selectors. Split the module or review a narrower source target.",
      });
    return selectors.slice(0, 512);
  } catch (error) {
    diagnostics.push({
      code: "review-source-missing",
      category: "error",
      phase: "review",
      target: `source:${sourcePath}`,
      path: sourcePath,
      message:
        error instanceof Error
          ? error.message
          : `Source ${sourcePath} cannot be read. Correct it before review.`,
    });
    return [];
  }
};

const shotSourceSelectors = (
  project: AutoMovieProductionProject,
  sourcePath: string | undefined,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMoviePrepareReviewOutput["quotable"] =>
  sourcePath === undefined
    ? []
    : sourceSelectors(project, sourcePath, diagnostics);

const resolveJsonPointer = (
  root: unknown,
  pointer: string,
): { found: boolean; value: unknown } => {
  if (pointer === "") return { found: true, value: root };
  if (pointer.startsWith("/") === false)
    return { found: false, value: undefined };
  let current = root;
  for (const encoded of pointer.slice(1).split("/")) {
    const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    if (
      typeof current !== "object" ||
      current === null ||
      Object.prototype.hasOwnProperty.call(current, key) === false
    )
      return { found: false, value: undefined };
    current = (current as Record<string, unknown>)[key];
  }
  return { found: true, value: current };
};

const criteriaOf = (target: IAutoMovieReviewTarget): readonly string[] =>
  AUTOMOVIE_REVIEW_CRITERIA[target.kind];

const highRiskCriteria = (target: IAutoMovieReviewTarget): string[] => {
  switch (target.kind) {
    case "asset":
      return ["silhouette-and-proportion", "rig-convention-and-rom"];
    case "design":
      return ["identity-and-references"];
    case "source":
      return ["determinism", "engine-enforcement"];
    case "shot":
      return ["beat-fidelity", "representability"];
    case "rendition":
      return ["visual-fidelity-to-source", "anatomy-and-artifact-integrity"];
    case "sequence":
      return ["cross-shot-continuity", "spatial-model-maintenance"];
    case "film":
      return ["narrative-completion", "delivery-readiness"];
  }
};

const reviewState = (
  review: Pick<IAutoMovieStoredReview, "complete" | "checks">,
): "incomplete" | "revise" | "complete" =>
  review.complete
    ? "complete"
    : review.checks.some((check) => check.verdict === "revise")
      ? "revise"
      : "incomplete";

const refused = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  currentFingerprint: AutoMovieContentDigest,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieSubmitReviewOutput => {
  const existing = project.review(target);
  return {
    accepted: false,
    target,
    fingerprint: null,
    state:
      existing === null
        ? "missing"
        : existing.fingerprint !== currentFingerprint
          ? "stale"
          : reviewState(existing),
    diagnostics: diagnostics
      .map(appendReviewCorrectionSafety)
      .sort(compareDiagnostics),
  };
};

const appendReviewCorrectionSafety = (
  diagnostic: IAutoMovieDiagnostic,
): IAutoMovieDiagnostic =>
  diagnostic.message.includes(
    "Correction feedback does not authorize deleting the artifact.",
  )
    ? diagnostic
    : {
        ...diagnostic,
        message: `${diagnostic.message} Correction feedback does not authorize deleting the artifact.`,
      };

const sameDesignTarget = (
  left: IAutoMovieDesignTarget,
  right: IAutoMovieDesignTarget,
): boolean =>
  left.kind === right.kind &&
  ("id" in left
    ? "id" in right && left.id === right.id
    : "id" in right === false);

const sameStringSet = (
  left: readonly string[],
  right: readonly string[],
): boolean => {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort(compareCodeUnits);
  const sortedRight = [...right].sort(compareCodeUnits);
  return sortedLeft.every((value, index) => value === sortedRight[index]);
};

const reviewTargetKey = (target: IAutoMovieReviewTarget): string => {
  if (target.kind === "source") return `source:${target.path}`;
  if (
    target.kind === "asset" ||
    target.kind === "shot" ||
    target.kind === "rendition" ||
    target.kind === "sequence" ||
    target.kind === "film"
  )
    return `${target.kind}:${target.id}`;
  return target.design.kind === "production" || target.design.kind === "world"
    ? `design:${target.design.kind}`
    : `design:${target.design.kind}:${target.design.id}`;
};

const targetPath = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
): string | null => {
  const production = encodeAutoMoviePathSegment(project.productionId);
  if (target.kind === "source") return target.path;
  if (target.kind === "asset")
    return `.automovie/design/shared/models/${encodeAutoMoviePathSegment(target.id)}.json`;
  if (target.kind === "shot")
    return `.automovie/design/${production}/shots/${encodeAutoMoviePathSegment(target.id)}.json`;
  if (target.kind === "rendition")
    return `.automovie/productions/${production}/renditions/active/${encodeAutoMoviePathSegment(target.id)}.json`;
  if (target.kind === "sequence")
    return `.automovie/design/${production}/screenplay/index.json`;
  if (target.kind === "film")
    return `.automovie/design/${production}/production.json`;
  if (target.design.kind === "production")
    return `.automovie/design/${production}/production.json`;
  if (target.design.kind === "world")
    return ".automovie/design/shared/world.json";
  const directory =
    target.design.kind === "acceptance"
      ? "acceptance"
      : `${target.design.kind}s`;
  const scope =
    target.design.kind === "model" || target.design.kind === "formation"
      ? "shared"
      : production;
  return `.automovie/design/${scope}/${directory}/${encodeAutoMoviePathSegment(target.design.id)}.json`;
};

const visualReviewTarget = (
  target: IAutoMovieReviewTarget,
): target is Extract<
  IAutoMovieReviewTarget,
  { kind: "asset" | "shot" | "rendition" | "sequence" | "film" }
> =>
  target.kind === "asset" ||
  target.kind === "shot" ||
  target.kind === "rendition" ||
  target.kind === "sequence" ||
  target.kind === "film";

const readJsonIfPresent = (
  project: AutoMovieProductionProject,
  renderRoot: string,
  file: string,
): unknown => {
  try {
    return JSON.parse(
      Buffer.from(
        project.readRenderFile(normalizeSlash(path.relative(renderRoot, file))),
      ).toString("utf8"),
    ) as unknown;
  } catch (error) {
    return { invalidJson: String(error) };
  }
};

const appendInvalidRenderManifestDiagnostics = (
  project: AutoMovieProductionProject,
  diagnostics: IAutoMovieDiagnostic[],
  entries: readonly IInvalidRenderManifestInventoryEntry[],
): void => {
  for (const entry of entries) {
    const relativePath = normalizeSlash(
      path.relative(project.root, entry.path),
    );
    diagnostics.push({
      code: "render-bundle-invalid",
      category: "error",
      phase: "render",
      target: relativePath,
      path: relativePath,
      message: `Render bundle manifest is invalid: ${entry.error}. Recreate the bundle through captureFrame.`,
    });
  }
};

/**
 * Read and validate every render manifest once for one review queue cycle.
 *
 * Valid manifests are indexed by target, so N shots no longer rescan and
 * reparse the complete render tree N times. Invalid manifests remain global
 * diagnostics because their target cannot be trusted. Discovery fences every
 * physical directory identity, and manifest bytes use the render-root reader.
 */
const collectRenderManifestInventory = (
  project: AutoMovieProductionProject,
): IReviewReadContext["renderInventory"] => {
  const invalid: IInvalidRenderManifestInventoryEntry[] = [];
  const legacy: ILegacyRenderManifestInventoryEntry[] = [];
  const all: IRenderManifestInventoryEntry[] = [];
  const byTarget = new Map<string, IRenderManifestInventoryEntry[]>();
  const renderRoot = project.renderRoot();
  for (const manifestPath of listNamedFiles(renderRoot, "manifest.json")) {
    const value = readJsonIfPresent(project, renderRoot, manifestPath);
    const legacyValidation =
      typia.validateEquals<AutoMovieRenderBundleManifestV2>(value);
    if (
      legacyValidation.success &&
      legacyValidation.data.rendererIdentity.trim().length !== 0
    ) {
      legacy.push({
        path: manifestPath,
        target: legacyValidation.data.target,
      });
      continue;
    }
    const validation =
      typia.validateEquals<IAutoMovieRenderBundleManifest>(value);
    if (validation.success === false) {
      invalid.push({
        path: manifestPath,
        manifest: null,
        error: validation.errors
          .map((error) => `${error.path} expects ${error.expected}`)
          .join("; "),
      });
      continue;
    }
    try {
      parseAutoMovieCaptureRuntimeIdentity(validation.data.rendererIdentity);
    } catch (error) {
      invalid.push({
        path: manifestPath,
        manifest: null,
        error: String(error),
      });
      continue;
    }
    const entry: IRenderManifestInventoryEntry = {
      path: manifestPath,
      manifest: validation.data,
      error: null,
    };
    all.push(entry);
    const key = reviewTargetKey(validation.data.target);
    const entries = byTarget.get(key) ?? [];
    entries.push(entry);
    byTarget.set(key, entries);
  }
  return { invalid, legacy, all, byTarget };
};

/** Reuse common renderer content and each target digest within one read cycle. */
const currentRenderTargetFingerprint = (
  project: AutoMovieProductionProject,
  generated: Parameters<typeof productionRenderTargetFingerprint>[1],
  target: IAutoMovieRenderBundleManifest["target"],
  context?: IReviewReadContext,
): AutoMovieContentDigest => {
  if (context === undefined)
    return productionRenderTargetFingerprint(project, generated, target);
  const key = canonicalizeAutoMovieJson(target);
  const retained = context.renderTargetFingerprints.get(key);
  if (retained !== undefined) return retained;
  context.renderContentInputs ??= project.contentInputs();
  const fingerprint = productionRenderTargetFingerprint(
    project,
    generated,
    target,
    context.renderContentInputs,
  );
  context.renderTargetFingerprints.set(key, fingerprint);
  return fingerprint;
};

const currentGeneratedManifest = (
  project: AutoMovieProductionProject,
  context?: IReviewReadContext,
): IAutoMovieGeneratedManifest | null =>
  context?.generatedManifest ?? project.generatedManifest();

const currentGeneratedFile = (
  project: AutoMovieProductionProject,
  relativePath: string,
  context?: IReviewReadContext,
): Uint8Array => {
  if (context?.generatedFiles === undefined)
    return project.readGeneratedFile(relativePath);
  return context.generatedFiles.get(relativePath)!;
};

const currentFilmTimeline = (
  project: AutoMovieProductionProject,
  fingerprint: AutoMovieContentDigest,
  context?: IReviewReadContext,
): IAutoMovieFilmTimeline =>
  parseAutoMovieFilmTimeline({
    manifest: currentGeneratedManifest(project, context),
    fingerprint,
    read: (file) => currentGeneratedFile(project, file, context),
  });

interface IRenderDirectoryIdentity {
  key: string;
}

const renderDirectoryIdentity = (
  rootReal: string,
  directory: string,
): IRenderDirectoryIdentity => {
  const linked = fs.lstatSync(directory);
  if (linked.isSymbolicLink())
    throw new Error(
      `Render inventory directory "${directory}" is not a physical directory.`,
    );
  if (linked.isDirectory() === false)
    throw new Error(
      `Render inventory directory "${directory}" is not a directory.`,
    );
  const real = fs.realpathSync(directory);
  if (isInside(rootReal, real) === false)
    throw new Error(
      `Render inventory directory "${directory}" escapes the render root.`,
    );
  const status = fs.statSync(real, { bigint: true });
  return {
    key: [real, status.dev.toString(), status.ino.toString()].join("\0"),
  };
};

const assertRenderDirectoryIdentity = (
  rootReal: string,
  directory: string,
  expected: IRenderDirectoryIdentity,
): void => {
  const current = renderDirectoryIdentity(rootReal, directory);
  if (current.key !== expected.key)
    throw new Error(
      `Render inventory directory "${directory}" changed physical identity during review evidence discovery.`,
    );
};

const listNamedFiles = (root: string, name: string): string[] => {
  const output: string[] = [];
  const rootReal = fs.realpathSync(root);
  const visit = (directory: string): void => {
    const identity = renderDirectoryIdentity(rootReal, directory);
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name));
    assertRenderDirectoryIdentity(rootReal, directory, identity);
    for (const entry of entries) {
      assertRenderDirectoryIdentity(rootReal, directory, identity);
      const child = path.join(directory, entry.name);
      const status = fs.lstatSync(child);
      if (status.isSymbolicLink()) {
        assertRenderDirectoryIdentity(rootReal, directory, identity);
        continue;
      }
      const realChild = fs.realpathSync(child);
      if (isInside(rootReal, realChild) === false)
        throw new Error(
          `Render inventory path "${child}" escapes the render root.`,
        );
      if (status.isDirectory()) visit(child);
      else if (status.isFile() && entry.name === name) output.push(child);
      assertRenderDirectoryIdentity(rootReal, directory, identity);
    }
    assertRenderDirectoryIdentity(rootReal, directory, identity);
  };
  visit(root);
  return output;
};

const resolveInside = (root: string, relative: string): string => {
  if (path.isAbsolute(relative))
    throw new Error(`Render frame path "${relative}" must be bundle-relative`);
  const resolved = path.resolve(root, relative);
  const relation = path.relative(root, resolved);
  if (
    relation === ".." ||
    relation.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relation)
  )
    throw new Error(`Render frame path "${relative}" escapes its bundle`);
  return resolved;
};

const isInside = (root: string, candidate: string): boolean => {
  const relation = path.relative(root, candidate);
  return (
    relation === "" ||
    (path.isAbsolute(relation) === false &&
      relation !== ".." &&
      relation.startsWith(`..${path.sep}`) === false)
  );
};

const hasVisiblePixelVariance = (png: PNG): boolean => {
  const alpha = png.data[3]!;
  const first = [
    png.data[0]! * alpha,
    png.data[1]! * alpha,
    png.data[2]! * alpha,
    alpha,
  ];
  for (let offset = 4; offset < png.data.length; offset += 4) {
    const currentAlpha = png.data[offset + 3]!;
    if (
      png.data[offset]! * currentAlpha !== first[0] ||
      png.data[offset + 1]! * currentAlpha !== first[1] ||
      png.data[offset + 2]! * currentAlpha !== first[2] ||
      currentAlpha !== first[3]
    )
      return true;
  }
  return false;
};

const compareDiagnostics = (
  left: IAutoMovieDiagnostic,
  right: IAutoMovieDiagnostic,
): number =>
  compareCodeUnits(left.phase, right.phase) ||
  compareCodeUnits(left.path ?? "", right.path ?? "") ||
  compareCodeUnits(left.code, right.code) ||
  compareCodeUnits(left.message, right.message);

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");
