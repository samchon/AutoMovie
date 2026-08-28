import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
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
  IAutoMovieRenderBundleManifest,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";

import { AutoMovieProductionCompiler } from "./AutoMovieProductionCompiler";
import type { IAutoMovieProductionServices } from "./AutoMovieProductionContext";
import { AutoMovieProductionOracleService } from "./AutoMovieProductionOracleService";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { compareCodeUnits } from "./contentIdentity";
import { readAutoMovieFilmTimeline } from "./filmTimeline";
import type { AutoMovieModelArchetypeRegistry } from "./productionArchetypes";
import { productionRenderTargetFingerprint } from "./renderIdentity";
import type { IAutoMovieProductionDesignGraph } from "./validateProductionDesign";

const PROJECT_MARKERS = [
  "automovie.config.ts",
  "automovie/manifest.json",
] as const;

/**
 * Exact grapheme implementation this package can evaluate.
 *
 * The production still chooses whether to adopt this identity and owns every
 * threshold. A different algorithm or Unicode/ICU revision is reported as
 * unsupported and never evaluated through a substitute profile.
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
        `No AutoMovie workspace marker was found above host seed "${resolved}". Run inside a scaffold containing automovie.config.ts, or initialize automovie/manifest.json first.`,
      );
    current = parent;
  }
};

/**
 * Open the compiler, oracle, and project runtime.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Carries the one graph-derived authoring snapshot into every compiler service opened for a library.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Preserves one authoring truth across status, review, final, and publication consumers.
 * @author Samchon
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
  /** Exact graph-derived authoring identity for review and final gates. */
  authoringEvidence?: IAutoMovieProductionEvidence;
}): IAutoMovieProductionServices => {
  const project = AutoMovieProductionProject.open(
    findAutoMovieProjectRoot(props.projectRoot),
    props.productionId,
    props.archetypes,
  );
  const statusCompiler = new AutoMovieProductionCompiler(
    project,
    props.authoringEvidence,
  );
  const compiler = new AutoMovieProductionCompiler(
    project,
    props.authoringEvidence,
  );
  return {
    project,
    compiler,
    compileStatus: () => statusCompiler.lint({ scope: "source" }),
    oracle: new AutoMovieProductionOracleService(project, props.capture, () =>
      statusCompiler.lint({ scope: "source" }),
    ),
  };
};

/**
 * Compile through the package API.
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
 * Project status projection for CLI and lint consumers.
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
  const sequenceIds = new Set(
    (services.project.screenplayIndex()?.treatment.sequences ?? []).map(
      (sequence) => sequence.id,
    ),
  );
  const renders = listNamedFiles(services.project.renderRoot(), "manifest.json")
    .map((file) => {
      const manifest = services.project.verifiedRenderManifest(file);
      return {
        path: normalizeSlash(path.relative(services.project.root, file)),
        current:
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
            ),
        target: manifest?.target ?? null,
        owned: renderTargetOwned(graph, sequenceIds, manifest?.target ?? null),
      };
    })
    .sort((left, right) => compareCodeUnits(left.path, right.path));
  const nextActions: IAutoMovieProductionNextAction[] = [
    ...diagnostics
      .filter((diagnostic) => diagnostic.category === "error")
      .map(diagnosticNextAction),
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

/**
 * Whether the design still carries the target a render bundle was made for.
 *
 * `current` says the bundle no longer matches its inputs, which is the ordinary
 * result of iterating: on one measured production, 42 render entries carried 39
 * `current: false`, and 38 of those were superseded renders of shots that still
 * exist. The thirty-ninth was the render of a shot the design no longer carries,
 * and nothing on the entry separated it from the other thirty-eight. Recovering
 * that difference meant parsing a shot id out of a directory name and diffing it
 * against the compile manifest by hand.
 *
 * `false` is an accusation, so it is only returned where ownership was actually
 * resolved. An unreadable manifest reports owned, because a bundle is not garbage
 * for having failed to open. So does a kind this cannot resolve, which is why the
 * switch is exhaustive over the manifest's own union rather than defaulting: a
 * new target kind added there should make this fail to compile instead of quietly
 * calling every bundle of that kind unowned.
 *
 * Nothing here deletes anything. The reader decides.
 */
const renderTargetOwned = (
  graph: IAutoMovieProductionDesignGraph,
  sequenceIds: ReadonlySet<string>,
  target: IAutoMovieRenderBundleManifest["target"] | null,
): boolean => {
  if (target === null) return true;
  switch (target.kind) {
    case "shot":
      return graph.shots.has(target.id);
    case "asset":
      return graph.models.has(target.id);
    case "sequence":
      return sequenceIds.has(target.id);
    case "film":
      return graph.production?.id === target.id;
  }
};
