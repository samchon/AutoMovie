import {
  AutoMovieProductionFrameCapture,
  IAutoMovieCaptionReadabilityBoundary,
  IAutoMovieCaptionReadabilityMeasurement,
  IAutoMovieCaptionReadabilityOutcome,
  IAutoMovieCaptionReadabilityProfile,
  IAutoMovieCaptionReadabilityReport,
  IAutoMovieCompileProjectInput,
  IAutoMovieCompileProjectOutput,
  IAutoMovieDiagnostic,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionInspection,
  IAutoMovieProductionNextAction,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";

import { AutoMovieProductionCompiler } from "./AutoMovieProductionCompiler";
import type { IAutoMovieProductionServices } from "./AutoMovieProductionContext";
import { AutoMovieProductionOracleService } from "./AutoMovieProductionOracleService";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { AutoMovieProductionReviewService } from "./AutoMovieProductionReviewService";
import { compareCodeUnits } from "./contentIdentity";
import { readAutoMovieFilmTimeline } from "./filmTimeline";
import type { AutoMovieModelArchetypeRegistry } from "./productionArchetypes";
import { productionRenderTargetFingerprint } from "./renderIdentity";

const PROJECT_MARKERS = [
  "automovie.config.ts",
  ".automovie/manifest.json",
] as const;

/**
 * Exact grapheme implementation this MCP package can evaluate.
 *
 * The production still chooses whether to adopt this identity and owns every
 * threshold. A different algorithm or Unicode/ICU revision is reported as
 * unsupported and never evaluated through a substitute profile.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Makes the supported segmentation revision explicit without supplying thresholds.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Binds evaluation to the installed Unicode and ICU segmentation data.
 */
export const AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION = Object.freeze({
  algorithm: "intl-segmenter-grapheme",
  version: `unicode-${process.versions.unicode}/icu-${process.versions.icu}`,
});

const CAPTION_GRAPHEME_SEGMENTER = new Intl.Segmenter("en", {
  granularity: "grapheme",
});

/**
 * Find the nearest immutable AutoMovie workspace from one host-owned seed.
 *
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-identity-inputs Requires the host path to identify one operation namespace.
 * @evidence specifications/execution-and-recovery/scope-and-execution-identities.md#execution-logical-job-identity Resolves one stable root before services are opened.
 */
export const findAutoMovieProjectRoot = (
  seed: string = process.cwd(),
): string => {
  const resolved = path.resolve(seed);
  let current =
    fs.existsSync(resolved) && fs.statSync(resolved).isFile()
      ? path.dirname(resolved)
      : resolved;
  for (;;) {
    if (
      PROJECT_MARKERS.some((marker) =>
        fs.existsSync(path.join(current, ...marker.split("/"))),
      )
    )
      return current;
    const parent = path.dirname(current);
    if (parent === current)
      throw new Error(
        `No AutoMovie workspace marker was found above host seed "${resolved}". Run inside a scaffold containing automovie.config.ts or initialize .automovie/manifest.json before starting the MCP host.`,
      );
    current = parent;
  }
};

/**
 * Open the non-MCP compiler, oracle, review, and project runtime.
 *
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-requested-effective-work Keeps the requested production distinct from the opened effective namespace.
 * @evidence specifications/execution-and-recovery/scope-and-execution-identities.md#execution-record-input-output Binds all returned services to the same project and production input.
 */
export const openAutoMovieProduction = (props: {
  /** Host-owned path at or below the project root. */
  projectRoot?: string;
  /** Exact production namespace, required when the project has several. */
  productionId?: string;
  /** Optional host-owned actual frame capture. */
  capture?: AutoMovieProductionFrameCapture;
  /**
   * Archetype catalogue this production registers.
   *
   * Omitted leaves the primitive catalogue the server ships with. A production
   * that supplies its own builders registers them here, and every recipe naming
   * something outside the registry is refused with a design diagnostic.
   */
  archetypes?: AutoMovieModelArchetypeRegistry;
}): IAutoMovieProductionServices => {
  const project = AutoMovieProductionProject.open(
    findAutoMovieProjectRoot(props.projectRoot),
    props.productionId,
    props.archetypes,
  );
  const statusCompiler = new AutoMovieProductionCompiler(project);
  const review = new AutoMovieProductionReviewService(project, () =>
    statusCompiler.lint({ scope: "source" }),
  );
  const compiler = new AutoMovieProductionCompiler(
    project,
    (status, snapshot) => review.queue(status, snapshot),
  );
  return {
    project,
    review,
    compiler,
    compileStatus: () => statusCompiler.lint({ scope: "source" }),
    oracle: new AutoMovieProductionOracleService(project, props.capture, () =>
      statusCompiler.lint({ scope: "source" }),
    ),
  };
};

/**
 * Compile through the package API without exposing compilation as an MCP tool.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Reuses only deterministic results for the same explicit scope.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Keeps compilation behind the ordinary package API and its verified inputs.
 */
export const compileAutoMovieProduction = (props: {
  /** Host-owned path at or below the project root. */
  projectRoot?: string;
  /** Exact production namespace. */
  productionId?: string;
  /** Highest atomic compiler gate. */
  scope: IAutoMovieCompileProjectInput["scope"];
  /** Archetype catalogue this production registers. */
  archetypes?: AutoMovieModelArchetypeRegistry;
}): IAutoMovieCompileProjectOutput =>
  openAutoMovieProduction(props).compiler.compile({ scope: props.scope });

/**
 * Project status projection for CLI/lint consumers, never an MCP tool.
 *
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-terminal-state-truth Reports current state without converting missing work into success.
 * @evidence specifications/execution-and-recovery/scope-and-execution-identities.md#execution-domain-result-separation Keeps inspection facts separate from operation state.
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Includes measure-only caption outcomes only for the current compiled timeline.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Delivers caption measurements and supported-profile verdicts in inspection.
 */
export const inspectAutoMovieProduction = (
  services: IAutoMovieProductionServices,
): IAutoMovieProductionInspection => {
  const graph = services.project.graph();
  const bound: string[] = [];
  const missing: string[] = [];
  for (const source of new Set(
    [...graph.shots.values()].map((shot) => shot.source.module),
  ))
    try {
      services.project.readSource(source);
      bound.push(source);
    } catch {
      missing.push(source);
    }
  bound.sort(compareCodeUnits);
  missing.sort(compareCodeUnits);
  const generated = services.project.generatedManifest();
  const owned = new Set(generated?.files.map((file) => file.path) ?? []);
  const unownedGenerated = listFiles(services.project.generatedRoot())
    .map((file) =>
      normalizeSlash(path.relative(services.project.generatedRoot(), file)),
    )
    .filter((file) => owned.has(file) === false);
  const compilation = services.compileStatus();
  const diagnostics = compilation.diagnostics;
  const reviews = services.review.queue(compilation);
  const renders = listNamedFiles(services.project.renderRoot(), "manifest.json")
    .map((file) => ({
      path: normalizeSlash(path.relative(services.project.root, file)),
      current: (() => {
        const manifest = services.project.verifiedRenderManifest(file);
        return (
          compilation.success &&
          generated !== null &&
          generated.inputFingerprint ===
            compilation.compiler.inputFingerprint &&
          manifest !== null &&
          manifest.targetFingerprint ===
            productionRenderTargetFingerprint(
              services.project,
              generated,
              manifest.target,
            )
        );
      })(),
    }))
    .sort((left, right) => compareCodeUnits(left.path, right.path));
  const nextActions: IAutoMovieProductionNextAction[] = [
    ...diagnostics
      .filter((diagnostic) => diagnostic.category === "error")
      .map(diagnosticNextAction),
    ...reviews.entries
      .filter((entry) => entry.state !== "complete")
      .map((entry) => ({
        owner: "review" as const,
        action: "prepareReview",
        target: JSON.stringify(entry.target),
        reason: `Current review state is ${entry.state}.`,
      })),
  ];
  const captionReadability =
    compilation.success &&
    graph.production !== null &&
    generated !== null &&
    generated.inputFingerprint === compilation.compiler.inputFingerprint
      ? inspectAutoMovieCaptionReadability(
          readAutoMovieFilmTimeline(
            services.project,
            compilation.compiler.inputFingerprint,
          ),
          graph.production.captionReadabilityProfiles ?? [],
        )
      : { version: 1 as const, cues: [] };
  return {
    revision: services.project.revision(),
    design: services.project.inventory(),
    source: { bound, missing, unownedGenerated },
    diagnostics,
    reviews,
    renders,
    captionReadability,
    nextActions,
  };
};

/**
 * Measure every canonical caption cue and apply only a matching supported
 * production-owned language profile.
 *
 * Missing profiles retain measurements with `not-run`. Unsupported requested
 * segmentation is also `not-run`; the fixed installed segmenter still reports
 * measure-only facts but is never substituted to produce a verdict.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Always reports cue metrics and reserves thresholds and verdict authority for the production.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Separates measurement, segmentation support, boundary comparison, and not-run outcomes.
 */
export const inspectAutoMovieCaptionReadability = (
  timeline: IAutoMovieFilmTimeline,
  profiles: readonly IAutoMovieCaptionReadabilityProfile[],
): IAutoMovieCaptionReadabilityReport => {
  const profilesByLanguage = new Map(
    profiles.map((profile) => [profile.language, profile] as const),
  );
  const precedingEndByLanguage = new Map<string, number>();
  return {
    version: 1,
    cues: timeline.tracks.captions.map((cue) => {
      const lines = cue.text.split(/\r\n|[\n\r]/u);
      const graphemesByLine = lines.map(countCaptionGraphemes);
      const graphemes = graphemesByLine.reduce(
        (total, count) => total + count,
        0,
      );
      const durationFrames = cue.endFrame - cue.startFrame;
      const precedingEnd = precedingEndByLanguage.get(cue.language);
      precedingEndByLanguage.set(cue.language, cue.endFrame);
      const measurement: IAutoMovieCaptionReadabilityMeasurement = {
        cue: cue.id,
        language: cue.language,
        graphemes,
        lines: lines.length,
        maxLineGraphemes: Math.max(...graphemesByLine),
        durationFrames,
        gapBeforeFrames:
          precedingEnd === undefined ? null : cue.startFrame - precedingEnd,
        graphemesPerSecond: (graphemes * timeline.fps) / durationFrames,
      };
      return {
        measurement,
        outcome: captionReadabilityOutcome(
          measurement,
          profilesByLanguage.get(cue.language),
        ),
      };
    }),
  };
};

const countCaptionGraphemes = (value: string): number =>
  [...CAPTION_GRAPHEME_SEGMENTER.segment(value)].length;

const captionReadabilityOutcome = (
  measurement: IAutoMovieCaptionReadabilityMeasurement,
  profile: IAutoMovieCaptionReadabilityProfile | undefined,
): IAutoMovieCaptionReadabilityOutcome => {
  if (profile === undefined)
    return {
      status: "not-run",
      segmentation: null,
      reason: "caption-readability-profile-not-declared",
    };
  if (
    profile.segmentation.algorithm !==
      AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION.algorithm ||
    profile.segmentation.version !==
      AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION.version
  )
    return {
      status: "not-run",
      segmentation: profile.segmentation,
      reason: "caption-grapheme-segmentation-unsupported",
    };
  const breaches: Extract<
    IAutoMovieCaptionReadabilityOutcome,
    { status: "evaluated" }
  >["breaches"] = [];
  if (
    maximumBoundaryPassed(
      measurement.graphemesPerSecond,
      profile.maxGraphemesPerSecond,
    ) === false
  )
    breaches.push("graphemes-per-second");
  if (
    maximumBoundaryPassed(measurement.lines, profile.maxLinesPerCue) === false
  )
    breaches.push("lines-per-cue");
  if (
    maximumBoundaryPassed(
      measurement.maxLineGraphemes,
      profile.maxGraphemesPerLine,
    ) === false
  )
    breaches.push("graphemes-per-line");
  if (
    minimumBoundaryPassed(
      measurement.durationFrames,
      profile.minDurationFrames,
    ) === false
  )
    breaches.push("duration-frames");
  if (
    measurement.gapBeforeFrames !== null &&
    minimumBoundaryPassed(measurement.gapBeforeFrames, profile.minGapFrames) ===
      false
  )
    breaches.push("gap-frames");
  return {
    status: "evaluated",
    profile: profile.id,
    segmentation: profile.segmentation,
    passed: breaches.length === 0,
    breaches,
  };
};

const maximumBoundaryPassed = (
  value: number,
  boundary: IAutoMovieCaptionReadabilityBoundary,
): boolean =>
  boundary.inclusive ? value <= boundary.value : value < boundary.value;

const minimumBoundaryPassed = (
  value: number,
  boundary: IAutoMovieCaptionReadabilityBoundary,
): boolean =>
  boundary.inclusive ? value >= boundary.value : value > boundary.value;

const listFiles = (root: string): string[] => {
  const output: string[] = [];
  const visit = (directory: string): void => {
    if (fs.existsSync(directory) === false) return;
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const child = path.join(directory, entry.name);
      const status = fs.lstatSync(child);
      if (status.isSymbolicLink()) output.push(child);
      else if (status.isDirectory()) visit(child);
      else if (status.isFile()) output.push(child);
    }
  };
  visit(root);
  return output;
};

const diagnosticNextAction = (
  diagnostic: IAutoMovieDiagnostic,
): IAutoMovieProductionNextAction => {
  if (diagnostic.phase === "design")
    return {
      owner: "design",
      action: "correct-design",
      target: diagnostic.target,
      reason: diagnostic.message,
    };
  if (diagnostic.phase === "source")
    return {
      owner: "source",
      action: "correct-source",
      target: diagnostic.path!,
      reason: diagnostic.message,
    };
  return {
    owner: "compile",
    action:
      diagnostic.code === "generated-unowned" ||
      diagnostic.code === "generated-path-outside"
        ? "remove-unowned-generated"
        : "compile",
    target: diagnostic.target,
    reason: diagnostic.message,
  };
};

const listNamedFiles = (root: string, name: string): string[] =>
  listFiles(root).filter((file) => path.basename(file) === name);

const normalizeSlash = (value: string): string =>
  value.split(path.sep).join("/");
