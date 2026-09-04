import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieProductionFrameCapture,
  IAutoMovieCaptionGraphemeSegmentationIdentity,
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
import { inspectAutoMovieCaptionReadabilityWithRuntime } from "./captionReadability";
import { compareCodeUnits } from "./contentIdentity";
import { readAutoMovieFilmTimeline } from "./filmTimeline";
import type { AutoMovieModelArchetypeRegistry } from "./productionArchetypes";
import { productionRenderTargetFingerprint } from "./renderIdentity";
import type { IAutoMovieProductionDesignGraph } from "./validateProductionDesign";

/**
 * What makes a directory the root of one generated production project.
 *
 * Both markers already exist for reasons of their own, which is the point: the
 * walk reads the project's own identity rather than a reserved state directory
 * it would then have to create in order to be found. `package.json` names the
 * project and the production namespace derived from it, and `lint.config.ts`
 * is the one typed declaration of the production's kind, populations, stages,
 * and graph. Requiring both is what keeps a host seed inside an ordinary Node
 * package from resolving to that package and having production state written
 * underneath it.
 *
 * Neither marker is a place a decision could hide. `automovie.config.ts` was
 * the second marker until the delivery decisions it carried moved onto the
 * production design record they always belonged to, and there is no file left
 * whose only job is to be found.
 *
 * `automovie/manifest.json` used to stand in for either of them. It no longer
 * does: that path is the legacy v1 layout, which is import input rather than a
 * shape any current project is asked to carry, so discovery must not depend on
 * a state tree existing before the project can be opened.
 */
const PROJECT_MARKERS = ["package.json", "lint.config.ts"] as const;

const CAPTION_GRAPHEME_SEGMENTER = new Intl.Segmenter("en", {
  granularity: "grapheme",
});
const CAPTION_GRAPHEME_SEGMENTER_OPTIONS =
  CAPTION_GRAPHEME_SEGMENTER.resolvedOptions();

/**
 * Exact grapheme implementation this package can evaluate.
 *
 * The identity is derived from the same segmenter that performs measurement.
 * The production still chooses whether to adopt it and owns every threshold;
 * a different complete identity remains unsupported without fallback.
 */
export const AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION = Object.freeze({
  algorithm: "intl-segmenter-grapheme",
  version: `unicode-${process.versions.unicode}/icu-${process.versions.icu}`,
  granularity: CAPTION_GRAPHEME_SEGMENTER_OPTIONS.granularity as "grapheme",
  locale: Object.freeze({
    kind: "requested-resolved" as const,
    requested: "en",
    resolved: CAPTION_GRAPHEME_SEGMENTER_OPTIONS.locale,
  }),
}) satisfies IAutoMovieCaptionGraphemeSegmentationIdentity;

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
      PROJECT_MARKERS.every((marker) =>
        fs.existsSync(path.join(current, ...marker.split("/"))),
      )
    )
      return current;
    const parent = path.dirname(current);
    if (parent === current)
      throw new Error(
        `No AutoMovie project was found above host seed "${resolved}". Run inside a generated project that carries both ${PROJECT_MARKERS.join(" and ")}.`,
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
  /** Fresh graph reader used by every atomic currentness confirmation. */
  currentAuthoringEvidence?: () => IAutoMovieProductionEvidence;
}): IAutoMovieProductionServices => {
  const project = AutoMovieProductionProject.open(
    findAutoMovieProjectRoot(props.projectRoot),
    props.productionId,
    props.archetypes,
  );
  const statusCompiler = new AutoMovieProductionCompiler(
    project,
    props.authoringEvidence,
    props.currentAuthoringEvidence,
  );
  const compiler = new AutoMovieProductionCompiler(
    project,
    props.authoringEvidence,
    props.currentAuthoringEvidence,
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
  /**
   * Exact graph-derived authoring identity, required to compile a library.
   *
   * The compiler chooses its shape from this declaration, so a library
   * compiled without it takes the film path and is refused for a design tree
   * it was never going to have. A film or brief may omit it, which is why it
   * stays optional rather than becoming a required argument on the one entry
   * every generated project calls.
   */
  authoringEvidence?: IAutoMovieProductionEvidence;
  /** Fresh graph reader used by every atomic currentness confirmation. */
  currentAuthoringEvidence?: () => IAutoMovieProductionEvidence;
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
      : { version: 2 as const, cues: [] };
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
): IAutoMovieCaptionReadabilityReport =>
  inspectAutoMovieCaptionReadabilityWithRuntime(timeline, profiles, {
    identity: AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION,
    segment: (value) => CAPTION_GRAPHEME_SEGMENTER.segment(value),
  });

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
