import {
  AutoMovieProductionFrameCapture,
  IAutoMovieCompileProjectInput,
  IAutoMovieCompileProjectOutput,
  IAutoMovieDiagnostic,
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
import type { AutoMovieModelArchetypeRegistry } from "./productionArchetypes";
import { productionRenderTargetFingerprint } from "./renderIdentity";

const PROJECT_MARKERS = [
  "automovie.config.ts",
  ".automovie/manifest.json",
] as const;

/** Find the nearest immutable AutoMovie workspace from one host-owned seed. */
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

/** Open the non-MCP compiler, oracle, review, and project runtime. */
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

/** Compile through the package API without exposing compilation as an MCP tool. */
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

/** Project status projection for CLI/lint consumers, never an MCP tool. */
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
  return {
    revision: services.project.revision(),
    design: services.project.inventory(),
    source: { bound, missing, unownedGenerated },
    diagnostics,
    reviews,
    renders,
    nextActions,
  };
};

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
