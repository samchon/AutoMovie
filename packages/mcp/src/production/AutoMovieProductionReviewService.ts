import {
  AutoMovieContentDigest,
  IAutoMovieAcceptanceScenario,
  IAutoMovieCompileProjectOutput,
  IAutoMovieDesignTarget,
  IAutoMovieDiagnostic,
  IAutoMovieFrameEvidenceReference,
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
} from "./AutoMovieProductionCompiler";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import {
  AUTOMOVIE_REVIEW_FINGERPRINT_PROTOCOL,
  IAutoMovieFingerprintField,
  canonicalAutoMovieJsonBytes,
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  digestAutoMovieBytes,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "./contentIdentity";

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
    "test-coverage",
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
    "audio-picture-synchronization",
    "deliverable-completeness",
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
    const graph = this.project.graph();
    const compileStatus =
      input.target.kind === "shot" || input.target.kind === "film"
        ? this.compileStatus()
        : null;
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
    const frames = currentFrames(
      this.project,
      input.target,
      diagnostics,
      compileStatus!,
    );
    if (
      (input.target.kind === "shot" || input.target.kind === "film") &&
      frames.length === 0
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
      fingerprint: reviewFingerprint(this.project, input.target, compileStatus),
      requiredCriteria: [...criteriaOf(input.target)],
      quotable,
      frames,
      diagnostics,
    };
  }

  /** Validate and store one external-agent review worksheet. */
  public submit(
    input: IAutoMovieSubmitReviewInput,
  ): IAutoMovieSubmitReviewOutput {
    const prepared = this.prepare({ target: input.target });
    const diagnostics = [
      ...prepared.diagnostics.filter(
        (diagnostic) => diagnostic.category === "error",
      ),
      ...validateWorksheet(this.project, input, prepared),
    ];
    if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
      return refused(input.target, diagnostics);
    const fingerprint = reviewFingerprint(
      this.project,
      input.target,
      input.target.kind === "shot" || input.target.kind === "film"
        ? this.compileStatus()
        : null,
    );
    /* c8 ignore start -- submit is synchronous; this defensive branch is
       reachable only through a hostile getter mutating project bytes during
       validation, while commitFiles separately enforces revision races. */
    if (fingerprint !== prepared.fingerprint)
      return refused(input.target, [
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
    /* c8 ignore stop */
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

  /** Derive missing, stale, incomplete, revise and complete states. */
  public queue(): IAutoMovieReviewQueue {
    const compileStatus = this.compileStatus();
    const entries = reviewTargets(this.project).map((target) => {
      const currentFingerprint = reviewFingerprint(
        this.project,
        target,
        compileStatus,
      );
      const stored = this.project.review(target);
      return {
        target,
        state:
          stored === null
            ? ("missing" as const)
            : stored.fingerprint !== currentFingerprint
              ? ("stale" as const)
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
  input: IAutoMovieSubmitReviewInput,
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
  for (const check of input.checks) {
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
    for (const evidence of check.evidence)
      diagnostics.push(
        ...validateEvidence(project, input.target, evidence, prepared, check),
      );
  }
  if (input.complete) {
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
  } else {
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
    /* c8 ignore next -- prepared line selectors are synchronous and in range. */
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
): AutoMovieContentDigest => {
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
    if (target.design.kind === "model")
      for (const lod of graph.models.get(target.design.id)?.lod ?? [])
        if (lod.recipe !== target.design.id)
          addJson(
            `dependency:model:${lod.recipe}`,
            graph.models.get(lod.recipe) ?? null,
          );
    if (target.design.kind === "formation")
      addJson(
        "dependency:model",
        graph.models.get(
          graph.formations.get(target.design.id)?.modelRecipe ?? "",
        ) ?? null,
      );
    if (target.design.kind === "shot") {
      const shot = graph.shots.get(target.design.id);
      for (const participant of shot?.participants ?? [])
        if (participant.kind === "formation")
          addJson(
            `dependency:formation:${participant.id}`,
            graph.formations.get(participant.id) ?? null,
          );
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
    addJson("generated-manifest", project.generatedManifest());
    for (const frame of currentFrames(project, target, [], compileStatus!))
      addJson(`frame:${frame.bundle}:${frame.frame}:${frame.pass}`, frame);
    fields.push(compilerField());
  } else {
    addJson("production", graph.production);
    for (const [id, acceptance] of graph.acceptance)
      addJson(`acceptance:${id}`, acceptance);
    for (const [id] of graph.shots) {
      const shotTarget: IAutoMovieReviewTarget = { kind: "shot", id };
      fields.push({
        role: `shot-current:${id}`,
        kind: "digest",
        payload: Buffer.from(
          reviewFingerprint(project, shotTarget, compileStatus!),
          "utf8",
        ),
      });
      fields.push({
        role: `shot-review:${id}`,
        kind: project.review(shotTarget) === null ? "absent" : "digest",
        payload: Buffer.from(
          project.review(shotTarget)?.fingerprint ?? "",
          "utf8",
        ),
      });
    }
    addJson(
      "render-manifest",
      readTrackedJsonIfPresent(project, "render-manifest.json"),
    );
  }
  return fingerprintAutoMovieFields(fields);
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
  for (const id of graph.acceptance.keys())
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

const currentFrames = (
  project: AutoMovieProductionProject,
  target: IAutoMovieReviewTarget,
  diagnostics: IAutoMovieDiagnostic[],
  compileStatus: IAutoMovieCompileProjectOutput,
): IAutoMovieFrameEvidenceReference[] => {
  if (target.kind !== "shot" && target.kind !== "film") return [];
  const generated = project.generatedManifest();
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
  for (const manifestPath of listNamedFiles(
    project.renderRoot(),
    "manifest.json",
  )) {
    const raw = readJsonIfPresent(manifestPath);
    const validation =
      typia.validateEquals<IAutoMovieRenderBundleManifest>(raw);
    if (validation.success === false) {
      diagnostics.push({
        code: "render-bundle-invalid",
        category: "error",
        phase: "render",
        target: normalizeSlash(path.relative(project.root, manifestPath)),
        path: normalizeSlash(path.relative(project.root, manifestPath)),
        message: `Render bundle manifest is invalid: ${validation.errors
          .map((error) => `${error.path} expects ${error.expected}`)
          .join("; ")}. Recreate the bundle through previewFrame.`,
      });
      continue;
    }
    const manifest = validation.data;
    if (
      manifest.target.kind !== target.kind ||
      manifest.target.id !== target.id ||
      manifest.compileFingerprint !== generated.inputFingerprint
    )
      continue;
    const bundleRoot = path.dirname(manifestPath);
    const bundle = normalizeSlash(path.relative(project.root, bundleRoot));
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
          hasVisiblePixelVariance(png) === false ||
          Math.abs(frame.time - expectedTime) > Number.EPSILON * 16
        )
          throw new Error(
            "digest, dimensions, visible pixels, or frame clock do not match",
          );
        frames.push({
          bundle,
          frame: frame.index,
          time: frame.time,
          pass: frame.pass,
          digest,
          width: png.width,
          height: png.height,
        });
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
  return frames.sort(
    (left, right) =>
      compareCodeUnits(left.bundle, right.bundle) ||
      left.frame - right.frame ||
      compareCodeUnits(left.pass, right.pass),
  );
};

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
      return ["cross-shot-continuity", "deliverable-completeness"];
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
  target: IAutoMovieReviewTarget,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieSubmitReviewOutput => ({
  accepted: false,
  target,
  fingerprint: null,
  state: "missing",
  diagnostics: diagnostics.sort(compareDiagnostics),
});

const sameDesignTarget = (
  left: IAutoMovieDesignTarget,
  right: IAutoMovieDesignTarget,
): boolean =>
  left.kind === right.kind &&
  ("id" in left
    ? "id" in right && left.id === right.id
    : "id" in right === false);

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
    return `.automovie/design/shots/${encodeURIComponent(target.id)}.json`;
  if (target.kind === "film") return ".automovie/design/production.json";
  if (target.design.kind === "production")
    return ".automovie/design/production.json";
  if (target.design.kind === "world") return ".automovie/design/world.json";
  return `.automovie/design/${target.design.kind}s/${encodeURIComponent(target.design.id)}.json`;
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
  if (png.data.length < 8) return false;
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
