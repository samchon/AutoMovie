import {
  AutoMovieContentDigest,
  IAutoMovieAcceptanceOutcomeReference,
  IAutoMovieAcceptanceScenario,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledShotSource,
  IAutoMovieDesignTarget,
  IAutoMovieDiagnostic,
  IAutoMovieFrameEvidenceReference,
  IAutoMovieGeneratedManifest,
  IAutoMoviePrepareReviewInput,
  IAutoMoviePrepareReviewOutput,
  IAutoMovieRenderBundleManifest,
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
} from "./AutoMovieProductionCompiler";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
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
import { productionRenderTargetFingerprint } from "./renderIdentity";
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
}

/** Required review criteria in their canonical submission order. */
export const AUTOMOVIE_REVIEW_CRITERIA = {
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
    "key-action-readability",
    "interaction-contact-and-order",
    "motion-and-grounding",
    "camera-and-occlusion",
    "timing-and-energy",
    "continuity-opening-and-closing",
    "acceptance-scenarios",
  ],
  film: [
    "narrative-causality",
    "cross-shot-continuity",
    "visual-scale-and-legibility",
    "rhythm-and-runtime",
    "acceptance-scenarios",
  ],
} as const;

/**
 * Evidence-bound review ledger driven by an external coding agent.
 *
 * The service never calls an LLM and never grades aesthetic prose. It verifies
 * target identity, exact selectors, actual current PNG bytes, checklist
 * coverage, self-consistency and fingerprint freshness, then stores the
 * external agent's worksheet as a tracked record.
 */
export class AutoMovieProductionReviewService {
  public constructor(
    private readonly project: AutoMovieProductionProject,
    private readonly compileStatus: () => IAutoMovieCompileProjectOutput = () =>
      new AutoMovieProductionCompiler(project).lint({ scope: "source" }),
  ) {}

  /** Prepare current selectors, frames and required criteria for one target. */
  public prepare(
    input: IAutoMoviePrepareReviewInput,
  ): IAutoMoviePrepareReviewOutput {
    const compileBound =
      input.target.kind === "source" ||
      input.target.kind === "shot" ||
      input.target.kind === "film";
    const compileStatus = compileBound ? this.compileStatus() : null;
    const visual = input.target.kind === "shot" || input.target.kind === "film";
    const context: IReviewReadContext | undefined = visual
      ? {
          renderInventory: collectRenderManifestInventory(this.project),
          fingerprints: new Map(),
          renderContentInputs: undefined,
          generatedManifest: undefined,
          generatedFiles: undefined,
          renderTargetFingerprints: new Map(),
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
        path: targetPath(input.target),
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
    const outcomes = currentAcceptanceOutcomes(
      this.project,
      input.target,
      diagnostics,
      compileStatus!,
      context,
    );
    if (
      (input.target.kind === "shot" || input.target.kind === "film") &&
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
          "This visual target has no verified current PNG frame. Run previewFrame for a required frame and pass before submitReview.",
      });
    const quotable =
      input.target.kind === "design" && targetValue !== null
        ? jsonPointers(targetValue, input.target.design)
        : input.target.kind === "source"
          ? sourceSelectors(this.project, input.target.path, diagnostics)
          : input.target.kind === "shot"
            ? shotSourceSelectors(
                this.project,
                graph.shots.get(input.target.id)?.source.module,
                diagnostics,
              )
            : [];
    diagnostics.sort(compareDiagnostics);
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
      outcomes,
      diagnostics,
    };
  }

  /** Validate and store one external-agent review worksheet. */
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
          path: targetPath(input.target),
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
    const fingerprint = reviewFingerprint(
      this.project,
      input.target,
      input.target.kind === "shot" || input.target.kind === "film"
        ? this.compileStatus()
        : null,
    );
    if (fingerprint !== prepared.fingerprint)
      return refused(this.project, input.target, fingerprint, [
        {
          code: "review-target-raced",
          category: "error",
          phase: "review",
          target: reviewTargetKey(input.target),
          path: targetPath(input.target),
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
    this.project.commitReview(stored);
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
    };
    const entries = reviewTargets(this.project).map((target) => {
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
              target.kind === "source" ||
                target.kind === "shot" ||
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
  const add = (code: string, message: string): void => {
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
      (input.target.kind === "shot" || input.target.kind === "film") &&
      input.checks.some((check) =>
        check.evidence.some((evidence) => evidence.kind === "frame"),
      ) === false
    )
      add(
        "review-evidence-missing",
        "A visual target cannot complete without a verified current frame. Capture and cite one required frame.",
      );
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
  if (input.target.kind !== "shot" && input.target.kind !== "film") return [];
  const target = input.target;
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const graph = project.graph();
  const scenarios = [...graph.acceptance.values()]
    .filter(
      (scenario) =>
        scenario.required &&
        (target.kind === "film" ||
          acceptanceAddressesShot(scenario, target.id)),
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
            evidence.shot === shot &&
            evidence.reviewFrame === criterion.frame &&
            evidence.pass === criterion.pass &&
            prepared.frames.some(
              (frame) =>
                frame.shot === evidence.shot &&
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
  const fail = (code: string, message: string): void => {
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
      target.kind !== "design" ||
      sameDesignTarget(target.design, evidence.target) === false
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
        item.shot === evidence.shot &&
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
      (target.kind !== "shot" && target.kind !== "film") ||
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
  return graph.production?.id === target.id ? graph.production : null;
};

const reviewFingerprint = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  compileStatus: IAutoMovieCompileProjectOutput | null,
  context?: IReviewReadContext,
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
  if (target.kind === "design") {
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
      if (
        acceptance !== undefined &&
        (acceptance.criterion.kind === "frame" ||
          acceptance.criterion.kind === "event") &&
        acceptance.criterion.shot !== undefined
      )
        addJson(
          `dependency:criterion-shot:${acceptance.criterion.shot}`,
          graph.shots.get(acceptance.criterion.shot) ?? null,
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
  } else {
    addJson("production", graph.production);
    addJson("compile-current", compileStatus!.compiler.inputFingerprint);
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
    }
    addJson(
      "render-manifest",
      readTrackedJsonIfPresent(project, "render-manifest.json"),
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
): IAutoMovieReviewTarget[] => {
  const graph = project.graph();
  const targets: IAutoMovieReviewTarget[] = [];
  if (graph.production !== null)
    targets.push({
      kind: "design",
      design: { kind: "production" },
    });
  for (const id of graph.models.keys())
    targets.push({ kind: "design", design: { kind: "model", id } });
  if (graph.world !== null)
    targets.push({ kind: "design", design: { kind: "world" } });
  for (const id of graph.formations.keys())
    targets.push({ kind: "design", design: { kind: "formation", id } });
  for (const [id, shot] of graph.shots) {
    targets.push({ kind: "design", design: { kind: "shot", id } });
    targets.push({ kind: "source", path: shot.source.module });
    targets.push({ kind: "shot", id });
  }
  for (const [id, acceptance] of graph.acceptance)
    if (acceptance.required)
      targets.push({ kind: "design", design: { kind: "acceptance", id } });
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

const acceptanceAddressesShot = (
  acceptance: IAutoMovieAcceptanceScenario,
  shot: string,
): boolean =>
  (acceptance.target.kind === "shot" && acceptance.target.id === shot) ||
  ((acceptance.criterion.kind === "frame" ||
    acceptance.criterion.kind === "event") &&
    acceptance.criterion.shot === shot);

const currentAcceptanceOutcomes = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  diagnostics: IAutoMovieDiagnostic[],
  compileStatus: IAutoMovieCompileProjectOutput,
  context?: IReviewReadContext,
): IAutoMovieAcceptanceOutcomeReference[] => {
  if (target.kind !== "shot" && target.kind !== "film") return [];
  const generated = currentGeneratedManifest(project, context);
  if (
    generated === null ||
    compileStatus.success === false ||
    compileStatus.compiler.inputFingerprint !== generated.inputFingerprint
  )
    return [];
  const graph = project.graph();
  const scenarios = [...graph.acceptance.values()]
    .filter(
      (scenario) =>
        scenario.required &&
        (target.kind === "film" ||
          acceptanceAddressesShot(scenario, target.id)),
    )
    .sort((left, right) => compareCodeUnits(left.id, right.id));
  const compiled = new Map<string, IAutoMovieCompiledShotSource>();
  const realizations = new Map<string, IAutoMovieCompiledContractRealization>();
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
    const fps = graph.production!.frameFormat.fps;
    const filmFrames =
      scenario.target.kind === "film"
        ? [...graph.shots.keys()].reduce<number | null>((frames, shot) => {
            if (frames === null) return null;
            const value = readCompiled(shot);
            return value === null
              ? null
              : frames + Math.round(value.shot.duration * fps);
          }, 0)
        : null;
    const actual =
      scenario.target.kind === "shot"
        ? readCompiled(scenario.target.id)?.shot.duration
        : filmFrames === null
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

const currentFrames = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  diagnostics: IAutoMovieDiagnostic[],
  compileStatus: IAutoMovieCompileProjectOutput,
  context?: IReviewReadContext,
): IAutoMovieFrameEvidenceReference[] => {
  if (target.kind !== "shot" && target.kind !== "film") return [];
  const generated = currentGeneratedManifest(project, context);
  if (generated === null) return [];
  if (
    compileStatus.success === false ||
    compileStatus.compiler.inputFingerprint !== generated.inputFingerprint
  ) {
    diagnostics.push({
      code: "review-evidence-stale",
      category: "error",
      phase: "review",
      target: reviewTargetKey(target),
      path: ".automovie/generated-manifest.json",
      message:
        "Generated output is not a clean compile of current design and source. Run compileProject before using any frame as review evidence.",
    });
    return [];
  }
  const frames: IAutoMovieFrameEvidenceReference[] = [];
  const graph = project.graph();
  const required = requiredReviewFrames(graph, target);
  const covered = new Set<string>();
  const inventory =
    context?.renderInventory ?? collectRenderManifestInventory(project);
  for (const entry of inventory.invalid)
    diagnostics.push({
      code: "render-bundle-invalid",
      category: "error",
      phase: "render",
      target: normalizeSlash(path.relative(project.root, entry.path)),
      path: normalizeSlash(path.relative(project.root, entry.path)),
      message: `Render bundle manifest is invalid: ${entry.error}. Recreate the bundle through previewFrame.`,
    });
  const legacyEntries =
    target.kind === "shot"
      ? inventory.legacy.filter(
          (entry) => reviewTargetKey(entry.target) === reviewTargetKey(target),
        )
      : inventory.legacy.filter(
          (entry) =>
            (entry.target.kind === "film" && entry.target.id === target.id) ||
            (entry.target.kind === "shot" && graph.shots.has(entry.target.id)),
        );
  for (const entry of legacyEntries)
    diagnostics.push({
      code: "render-bundle-legacy",
      category: "warning",
      phase: "render",
      target: normalizeSlash(path.relative(project.root, entry.path)),
      path: normalizeSlash(path.relative(project.root, entry.path)),
      message:
        "This legacy v2 render bundle is retained as historical output but is not current review evidence. Recapture required frames through previewFrame; a current v3 bundle supersedes this warning without deleting history.",
    });
  const manifestEntries =
    target.kind === "shot"
      ? (inventory.byTarget.get(reviewTargetKey(target)) ?? [])
      : inventory.all.filter(
          (entry) =>
            (entry.manifest?.target.kind === "film" &&
              entry.manifest.target.id === target.id) ||
            (entry.manifest?.target.kind === "shot" &&
              graph.shots.has(entry.manifest.target.id)),
        );
  for (const entry of manifestEntries) {
    const manifestPath = entry.path;
    const manifest = entry.manifest;
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
    const bundleRoot = path.dirname(manifestPath);
    const bundle = normalizeSlash(path.relative(project.root, bundleRoot));
    const owned = project.verifiedRenderManifest(manifestPath) !== null;
    if (owned === false)
      diagnostics.push({
        code: "render-bundle-unowned",
        category: "error",
        phase: "render",
        target: bundle,
        path: normalizeSlash(path.relative(project.root, manifestPath)),
        message:
          "This manifest is not at the canonical content-addressed path or lacks the matching MCP render receipt. Recreate it through previewFrame.",
      });
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
        const bytes = fs.readFileSync(realFile);
        const png = PNG.sync.read(bytes);
        const digest = digestAutoMovieBytes(bytes);
        const expectedTime = frame.index / manifest.renderSpec.frameFormat.fps;
        if (
          bytes.length === 0 ||
          digest !== frame.digest ||
          png.width !== frame.width ||
          png.height !== frame.height ||
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
            "digest, dimensions, visible pixels, or frame clock do not match",
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
        if (owned)
          for (const requirement of requirements) {
            frames.push({
              shot: requirement.shot,
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
          }. Recreate this frame through previewFrame.`,
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
        message: `Required review frame "${requirement.frame}" for shot "${requirement.shot}" at ${requirement.time}s pass "${requirement.pass}" has no current verified PNG. Call previewFrame for that exact shot, time, and pass.`,
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
  target: Extract<IAutoMovieReviewTarget, { kind: "shot" | "film" }>,
): IRequiredReviewFrame[] => {
  // currentFrames reaches this helper only after a clean compile, whose design
  // gate requires production metadata.
  const fps = graph.production!.frameFormat.fps;
  const shots =
    target.kind === "shot"
      ? [[target.id, graph.shots.get(target.id)] as const]
      : [...graph.shots.entries()];
  return shots.flatMap(([shotId, shot]) =>
    (shot?.reviewFrames ?? []).flatMap((frame) =>
      frame.passes.map((pass) => ({
        shot: shotId,
        frame: frame.id,
        time: frame.time,
        index: Math.round(frame.time * fps),
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
    case "design":
      return ["identity-and-references"];
    case "source":
      return ["determinism", "engine-enforcement"];
    case "shot":
      return ["motion-and-grounding", "camera-and-occlusion"];
    case "film":
      return ["cross-shot-continuity", "visual-scale-and-legibility"];
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
    diagnostics: diagnostics.sort(compareDiagnostics),
  };
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
  if (target.kind === "shot" || target.kind === "film")
    return `${target.kind}:${target.id}`;
  return target.design.kind === "production" || target.design.kind === "world"
    ? `design:${target.design.kind}`
    : `design:${target.design.kind}:${target.design.id}`;
};

const targetPath = (target: IAutoMovieReviewTarget): string | null => {
  if (target.kind === "source") return target.path;
  if (target.kind === "shot")
    return `.automovie/design/shots/${encodeAutoMoviePathSegment(target.id)}.json`;
  if (target.kind === "film") return ".automovie/design/production.json";
  if (target.design.kind === "production")
    return ".automovie/design/production.json";
  if (target.design.kind === "world") return ".automovie/design/world.json";
  const directory =
    target.design.kind === "acceptance"
      ? "acceptance"
      : `${target.design.kind}s`;
  return `.automovie/design/${directory}/${encodeAutoMoviePathSegment(target.design.id)}.json`;
};

const readJsonIfPresent = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    return { invalidJson: String(error) };
  }
};

const readTrackedJsonIfPresent = (
  project: AutoMovieProductionProject,
  relative: string,
): unknown => {
  try {
    const bytes = project.readTrackedStateFile(relative);
    return bytes === null
      ? null
      : (JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown);
  } catch (error) {
    return { invalidJson: String(error) };
  }
};

/**
 * Read and validate every render manifest once for one review queue cycle.
 *
 * Valid manifests are indexed by target, so N shots no longer rescan and
 * reparse the complete render tree N times. Invalid manifests remain global
 * diagnostics because their target cannot be trusted.
 */
const collectRenderManifestInventory = (
  project: AutoMovieProductionProject,
): IReviewReadContext["renderInventory"] => {
  const invalid: IInvalidRenderManifestInventoryEntry[] = [];
  const legacy: ILegacyRenderManifestInventoryEntry[] = [];
  const all: IRenderManifestInventoryEntry[] = [];
  const byTarget = new Map<string, IRenderManifestInventoryEntry[]>();
  for (const manifestPath of listNamedFiles(
    project.renderRoot(),
    "manifest.json",
  )) {
    const value = readJsonIfPresent(manifestPath);
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
  const key = reviewTargetKey(target);
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

const listNamedFiles = (root: string, name: string): string[] => {
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const child = path.join(directory, entry.name);
      const status = fs.lstatSync(child);
      if (status.isSymbolicLink()) continue;
      if (status.isDirectory()) visit(child);
      else if (status.isFile() && entry.name === name) output.push(child);
    }
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
