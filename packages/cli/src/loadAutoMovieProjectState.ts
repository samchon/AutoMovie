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

/** Input for loading one active production from an initialized project. */
export interface IAutoMovieProjectStateInput {
  /** Project root containing the tracked `.automovie` state directory. */
  root: string;
  /** Registered production id, or the project default when omitted. */
  productionId?: string;
}

/** One reason loaded compiler-owned state cannot be treated as current. */
export interface IAutoMovieProjectStateProblem {
  /** Stable machine-readable failure class. */
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
  /** Generated-root-relative path when one file caused the problem. */
  path: string | null;
  /** Human-readable evidence and correction direction. */
  message: string;
}

/** Compiler identity and freshness attached to one loaded state snapshot. */
export interface IAutoMovieProjectStateFreshness {
  /**
   * `current` is safe to query, `stale` preserves last generated evidence but
   * requires a compile, and `missing` means no generated manifest exists.
   */
  status: "current" | "stale" | "missing";
  /** Fingerprint of the loaded compiler-owned output, or null when absent. */
  compileFingerprint: AutoMovieContentDigest | null;
  /** Fingerprint recomputed from current design, source, and declared content. */
  currentFingerprint: AutoMovieContentDigest | null;
  /** Current read-only source-lint diagnostics. */
  diagnostics: readonly IAutoMovieDiagnostic[];
  /** Reader-level integrity and race evidence. */
  problems: readonly IAutoMovieProjectStateProblem[];
}

/** Compiler-owned artifacts loaded and typed from digest-verified JSON bytes. */
export interface IAutoMovieGeneratedProjectState {
  /** Ownership manifest that authenticated the loaded files. */
  manifest: IAutoMovieGeneratedManifest | null;
  /** Compiler registry of runtime assets, shots, and film. */
  registry: IAutoMovieProductionRegistryManifest | null;
  /** Design contracts copied into the generated snapshot at compile time. */
  design: IAutoMovieProductionDesignGraph;
  /** Compiler-materialized runtime models keyed by recipe id. */
  models: ReadonlyMap<string, IAutoMovieModel>;
  /** Compiler-materialized shots keyed by shot id. */
  shots: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  /** Compiler-materialized film timeline, when the compile produced one. */
  film: IAutoMovieFilmTimeline | null;
}

/** One transport-free, read-only project-state snapshot for ordinary scripts. */
export interface IAutoMovieProjectState {
  /** Absolute physical project root selected by the reader. */
  root: string;
  /** Exact active production namespace. */
  productionId: string;
  /** Project revision observed at the beginning of the read. */
  revision: number;
  /** Freshness and byte-integrity gate for the generated state. */
  freshness: IAutoMovieProjectStateFreshness;
  /** Current tracked design, which may be newer than generated state. */
  design: IAutoMovieProductionDesignGraph;
  /** Last compiler-owned state, loaded independently from current design. */
  generated: IAutoMovieGeneratedProjectState;
}

/**
 * Generated state whose ownership, registry, and required contracts are
 * current.
 */
export interface IAutoMovieCurrentGeneratedProjectState extends IAutoMovieGeneratedProjectState {
  manifest: IAutoMovieGeneratedManifest;
  registry: IAutoMovieProductionRegistryManifest;
  design: IAutoMovieProductionDesignGraph & {
    production: IAutoMovieProductionDesign;
    world: IAutoMovieWorldDesign;
  };
}

/** Project state narrowed by {@link requireCurrentAutoMovieProjectState}. */
export interface IAutoMovieCurrentProjectState extends IAutoMovieProjectState {
  freshness: IAutoMovieProjectStateFreshness & { status: "current" };
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

/** Refuse missing or stale output and narrow a loaded state for engine queries. */
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
