import {
  realizeShotContract,
  validateModel,
  validateMotion,
  validateShotArtifact,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieAssetManifest,
  IAutoMovieAssetProvenance,
  IAutoMovieCompileProjectInput,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledFilmEdit,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieFilmBuildContext,
  IAutoMovieFilmEdit,
  IAutoMovieFilmTimeline,
  IAutoMovieGeneratedFile,
  IAutoMovieGeneratedManifest,
  IAutoMovieMaterializedFile,
  IAutoMovieProductionManifest,
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderReceipt,
  IAutoMovieReviewQueue,
  IAutoMovieShotContract,
  IAutoMovieShotSourceOutput,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript-compiler";
import typia, { IValidation } from "typia";

import { validateSceneArtifact } from "../validators/artifacts";
import {
  AutoMovieProductionInputRaceError,
  AutoMovieProductionProject,
  AutoMovieProductionSourcePathError,
  IAutoMovieProductionContentInput,
} from "./AutoMovieProductionProject";
import {
  AUTOMOVIE_COMPILE_FINGERPRINT_PROTOCOL,
  IAutoMovieFingerprintField,
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "./contentIdentity";
import {
  materializeCompiledFormationInventory,
  materializeCompiledInstanceSetInventory,
  materializeCompiledShot,
  materializeProductionModels,
} from "./materializeProduction";
import { probeProductionMedia } from "./probeProductionMedia";
import {
  IAutoMovieProductionDesignGraph,
  validateAutoMovieProductionGraph,
} from "./validateProductionDesign";

/** Production compiler protocol embedded in generated manifests. */
export const AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL = "automovie.compiler.v6";

const FILM_SOURCE_PATH = "src/film.ts";
const FILM_SOURCE_EXPORT = "film";

/** Compiler package version. */
export const AUTOMOVIE_PRODUCTION_COMPILER_VERSION = (
  require(path.join(__dirname, "..", "..", "package.json")) as {
    version: string;
  }
).version;

/** Current review queue provider shared with the review service. */
export interface IAutoMovieReviewQueueSnapshot {
  /** Exact content inventory already used by the compiler fingerprint. */
  renderContentInputs: IAutoMovieProductionContentInput[];
  /** Prospective compiler ownership manifest used by this compile. */
  generatedManifest: IAutoMovieGeneratedManifest;
  /** Prospective compiler-owned bytes keyed by generated-root-relative path. */
  generatedFiles: ReadonlyMap<string, Uint8Array>;
}

/** Current review queue provider shared with the review service. */
export type AutoMovieReviewQueueProvider = (
  compileStatus: IAutoMovieCompileProjectOutput,
  snapshot?: IAutoMovieReviewQueueSnapshot,
) => IAutoMovieReviewQueue;

/**
 * Deterministic source compiler and generated-ownership gate.
 *
 * Coding-agent TypeScript runs in a no-I/O VM with explicit design input and
 * deterministic geometry helpers. It may use loops and ordinary math, but no
 * runtime imports, wall clock, random source, process, network or filesystem.
 * The resulting scene, shot, models and sparse motions are validated by the
 * same engine consumers use and then materialized atomically as derived data.
 */
export class AutoMovieProductionCompiler {
  public constructor(
    private readonly project: AutoMovieProductionProject,
    private readonly reviewQueue: AutoMovieReviewQueueProvider = () => ({
      entries: [],
    }),
  ) {}

  /** Compile the active design and source through the requested gate. */
  public compile(
    input: IAutoMovieCompileProjectInput,
  ): IAutoMovieCompileProjectOutput {
    return this.run(input, true);
  }

  /**
   * Run every compiler gate without materializing generated files.
   *
   * Project linters use this entry point so a read-only check can never repair
   * the ownership or freshness failure it is supposed to report.
   */
  public lint(
    input: IAutoMovieCompileProjectInput,
  ): IAutoMovieCompileProjectOutput {
    return this.run(input, false);
  }

  private run(
    input: IAutoMovieCompileProjectInput,
    materialize: boolean,
  ): IAutoMovieCompileProjectOutput {
    const graph = this.project.graph();
    const inputRevision = this.project.revision();
    const projectManifest = this.project.manifest();
    const diagnostics: IAutoMovieDiagnostic[] = [
      ...missingDesignDiagnostics(this.project, graph),
      ...validateAutoMovieProductionGraph(graph, this.project.productionId),
    ];
    const designReady = diagnostics.every(
      (diagnostic) => diagnostic.category !== "error",
    );
    const sourceFields: IAutoMovieFingerprintField[] = [];
    const compiled = new Map<string, IAutoMovieCompiledShotSource>();
    const realizations = new Map<
      string,
      IAutoMovieCompiledContractRealization
    >();
    let runtimeModels = new Map<
      string,
      IAutoMovieCompiledShotSource["models"][number]
    >();
    let formationRuntime: ReturnType<
      typeof materializeCompiledFormationInventory
    > = {};
    let instanceSetRuntime: ReturnType<
      typeof materializeCompiledInstanceSetInventory
    > = {};
    let filmSource: Uint8Array | null = null;
    let filmSourceDigest: AutoMovieContentDigest | null = null;
    if (input.scope !== "design" && designReady) {
      runtimeModels = new Map(materializeProductionModels(graph.models));
      formationRuntime = materializeCompiledFormationInventory(
        graph.formations,
        graph.models,
      );
      instanceSetRuntime = materializeCompiledInstanceSetInventory(
        graph.world!,
        graph.models,
      );
    }
    for (const [id, contract] of graph.shots) {
      if (input.scope === "design") {
        sourceFields.push({
          role: `source:${id}`,
          kind: "not-inspected",
          payload: new Uint8Array(),
        });
        continue;
      }
      let source: Uint8Array;
      try {
        source = this.project.readSource(contract.source.module);
      } catch (error) {
        diagnostics.push(
          sourcePathDiagnostic(id, contract.source.module, error),
        );
        sourceFields.push({
          role: `source:${id}`,
          kind: "absent",
          payload: new Uint8Array(),
        });
        continue;
      }
      const normalized = normalizeAutoMovieSource(source);
      sourceFields.push({
        role: `source:${id}`,
        kind: "typescript",
        payload: normalized,
      });
      if (designReady === false) continue;
      const result = compileShotSource({
        id,
        path: contract.source.module,
        exportName: contract.source.export,
        source: Buffer.from(normalized).toString("utf8"),
        context: {
          contract,
          models: Object.fromEntries(graph.models),
          world: graph.world!,
          formations: Object.fromEntries(graph.formations),
          runtimeModels: Object.fromEntries(runtimeModels),
          formationRuntime,
          instanceSetRuntime,
        },
      });
      diagnostics.push(...result.diagnostics);
      if (result.value !== null) {
        const materialized = materializeCompiledShot({
          contract,
          formations: graph.formations,
          formationRuntime,
          instanceSetRuntime,
          modelRecipes: graph.models,
          runtimeModels,
          world: graph.world!,
          fps: graph.production!.frameFormat.fps,
          source: result.value,
        });
        const realized = realizeShotContract({
          contract,
          production: graph.production,
          world: graph.world,
          formations: graph.formations,
          compiled: materialized.value,
          collisions: materialized.collisions,
        });
        diagnostics.push(
          ...validateCompiledShot(contract, materialized.value),
          ...realized.diagnostics,
        );
        compiled.set(id, materialized.value);
        realizations.set(id, realized.realization);
      }
    }
    if (input.scope === "design")
      sourceFields.push({
        role: "source:film",
        kind: "not-inspected",
        payload: new Uint8Array(),
      });
    else
      try {
        filmSource = normalizeAutoMovieSource(
          this.project.readSource(FILM_SOURCE_PATH),
        );
        filmSourceDigest = digestAutoMovieBytes(filmSource);
        sourceFields.push({
          role: "source:film",
          kind: "typescript",
          payload: filmSource,
        });
      } catch (error) {
        diagnostics.push(filmSourcePathDiagnostic(error));
        sourceFields.push({
          role: "source:film",
          kind: "absent",
          payload: new Uint8Array(),
        });
      }
    const contentFields: IAutoMovieFingerprintField[] = [];
    let contentInputs: IAutoMovieProductionContentInput[] | undefined;
    let declaredAssets: string[] = [];
    let assetRecords: IAutoMovieAssetProvenance[] = [];
    if (input.scope !== "design")
      try {
        contentInputs = this.project.contentInputs();
        contentFields.push(...contentFingerprintFields(contentInputs));
        const assetInventory = compilerAssetInventory(
          projectManifest.assetManifest,
          contentInputs,
          graph.production?.id ?? this.project.productionId,
          graph,
        );
        diagnostics.push(...assetInventory.diagnostics);
        declaredAssets = assetInventory.assets;
        assetRecords = assetInventory.records;
      } catch (error) {
        diagnostics.push({
          code: "content-input-unsafe",
          category: "error",
          phase: "source",
          target: "declared-content",
          path: ".automovie/manifest.json",
          message: `${errorMessage(error)} Correct contentRoots/contentFiles ownership before compileProject.`,
        });
        contentFields.push({
          role: "content:inventory",
          kind: "unsafe",
          payload: new Uint8Array(),
        });
      }
    let compiledFilm: ICompiledFilmDraft | null = null;
    if (
      input.scope !== "design" &&
      designReady &&
      filmSource !== null &&
      contentInputs !== undefined
    ) {
      const context: IAutoMovieFilmBuildContext = {
        production: graph.production!,
        shots: Object.fromEntries(graph.shots),
        assets: declaredAssets,
        effectZones: graph.world!.effectZones,
      };
      const film = compileFilmSource({
        source: Buffer.from(filmSource).toString("utf8"),
        context,
        contracts: graph.shots,
        compiled,
        realizations,
      });
      diagnostics.push(...film.diagnostics);
      if (film.value !== null) {
        const useDiagnostics = validateCompiledAssetUses(
          graph.production!.id,
          assetRecords,
          film.value.edit,
        );
        diagnostics.push(...useDiagnostics);
        if (useDiagnostics.length === 0) compiledFilm = film.value;
      }
    }
    const inputFingerprint = productionCompilerInputFingerprint(
      this.project.productionId,
      graph,
      sourceFields,
      contentFields,
    );
    const filmArtifacts =
      compiledFilm === null || filmSourceDigest === null
        ? null
        : materializeFilmArtifacts(
            compiledFilm,
            filmSourceDigest,
            inputFingerprint,
          );
    const inputCurrent = (): boolean =>
      `${this.project.revision()}\0${currentAutoMovieProductionCompilerInputFingerprint(this.project, input.scope)}\0${this.project.revision()}` ===
      `${inputRevision}\0${inputFingerprint}\0${inputRevision}`;
    const files =
      input.scope === "design"
        ? null
        : materializeGeneratedFiles(
            graph,
            runtimeModels,
            compiled,
            realizations,
            filmArtifacts,
            inputFingerprint,
          );
    const entries: IAutoMovieGeneratedFile[] =
      files === null
        ? []
        : [...files]
            .map(([file, bytes]) => ({
              path: file,
              owner: "compiler" as const,
              digest: digestAutoMovieBytes(bytes),
              sourceTargets: sourceTargetsOf(file, graph),
            }))
            .sort((left, right) => compareCodeUnits(left.path, right.path));
    const manifest: IAutoMovieGeneratedManifest | null =
      files === null
        ? null
        : {
            version: 1,
            compiler: {
              packageVersion: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
              protocolVersion: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
            },
            inputFingerprint,
            files: entries,
          };
    if (manifest !== null)
      diagnostics.push(
        ...this.generatedOwnershipDiagnostics(manifest, materialize),
      );
    const statusForReview = (): IAutoMovieCompileProjectOutput => ({
      success: diagnostics.every(
        (diagnostic) => diagnostic.category !== "error",
      ),
      revision: this.project.revision(),
      compiler: {
        version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
        inputFingerprint,
      },
      diagnostics: [...diagnostics],
      reviews: { entries: [] },
      materialized: [],
    });
    const reviewSnapshot: IAutoMovieReviewQueueSnapshot | undefined =
      contentInputs === undefined
        ? undefined
        : {
            renderContentInputs: contentInputs,
            generatedManifest: manifest!,
            generatedFiles: files!,
          };
    const reviews: IAutoMovieReviewQueue =
      diagnostics.some(
        (diagnostic) => diagnostic.code === "content-input-unsafe",
      ) || input.scope === "design"
        ? { entries: [] }
        : this.reviewQueue(statusForReview(), reviewSnapshot);
    if (input.scope === "review" || input.scope === "final")
      diagnostics.push(...reviewGateDiagnostics(reviews));
    if (input.scope === "final")
      diagnostics.push(
        ...finalDeliverableDiagnostics(
          this.project,
          graph.production,
          inputFingerprint,
        ),
      );
    diagnostics.sort(compareDiagnostics);
    const inputRaceFailure = (
      message: string,
    ): IAutoMovieCompileProjectOutput => {
      diagnostics.push({
        code: "compile-input-changed",
        category: "error",
        phase: "compile",
        target: "compiler-input",
        path: null,
        message: `${message} Re-run compileProject against the current design, source and declared content snapshot.`,
      });
      diagnostics.sort(compareDiagnostics);
      return {
        success: false,
        revision: this.project.revision(),
        compiler: {
          version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
          inputFingerprint,
        },
        diagnostics,
        reviews: { entries: [] },
        materialized: [],
      };
    };
    const confirmInputSnapshot = (): IAutoMovieCompileProjectOutput | null => {
      try {
        this.project.confirmCurrentSnapshot(inputCurrent, inputRevision);
        return null;
      } catch (error) {
        if (error instanceof AutoMovieProductionInputRaceError === false)
          throw error;
        return inputRaceFailure(error.message);
      }
    };
    if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
      return (
        confirmInputSnapshot() ?? {
          success: false,
          revision: inputRevision,
          compiler: {
            version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
            inputFingerprint,
          },
          diagnostics,
          reviews,
          materialized: [],
        }
      );
    if (input.scope === "design")
      return (
        confirmInputSnapshot() ?? {
          success: true,
          revision: inputRevision,
          compiler: {
            version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
            inputFingerprint,
          },
          diagnostics,
          reviews: { entries: [] },
          materialized: [],
        }
      );

    const sourceFiles = files!;
    const sourceManifest = manifest!;
    const materialized = statusesOf(this.project, entries);
    if (materialize === false)
      return (
        confirmInputSnapshot() ?? {
          success: true,
          revision: inputRevision,
          compiler: {
            version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
            inputFingerprint,
          },
          diagnostics,
          reviews,
          materialized: [],
        }
      );
    let revision: number;
    try {
      revision = this.project.commitGenerated(
        sourceFiles,
        sourceManifest,
        inputCurrent,
        inputRevision,
      );
    } catch (error) {
      if (error instanceof AutoMovieProductionInputRaceError === false)
        throw error;
      return inputRaceFailure(error.message);
    }
    return {
      success: true,
      revision,
      compiler: {
        version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
        inputFingerprint,
      },
      diagnostics,
      reviews,
      materialized,
    };
  }

  private generatedOwnershipDiagnostics(
    expected: IAutoMovieGeneratedManifest,
    repairDeclaredFiles: boolean,
  ): IAutoMovieDiagnostic[] {
    const manifest = this.project.generatedManifest();
    const generatedManifestPath = normalizeSlash(
      path.relative(
        this.project.root,
        this.project.trackedStatePath("generated-manifest.json"),
      ),
    );
    const diagnostics: IAutoMovieDiagnostic[] = [];
    const expectedByPath = new Map(
      expected.files.map((file) => [normalizeSlash(file.path), file]),
    );
    const declaredByPath = new Map(
      (manifest?.files ?? []).map((file) => [normalizeSlash(file.path), file]),
    );
    if (manifest === null)
      diagnostics.push({
        code: "generated-manifest-missing",
        category: repairDeclaredFiles ? "warning" : "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: repairDeclaredFiles
          ? "Compiler-owned output has no generated manifest. compileProject will publish the exact current ownership manifest with the derived files."
          : "Compiler-owned output has no generated manifest. Run compileProject before trusting generated bytes.",
      });
    for (const file of listFiles(this.project.generatedRoot())) {
      const relative = normalizeSlash(
        path.relative(this.project.generatedRoot(), file),
      );
      if (expectedByPath.has(relative) === false) {
        const declared = declaredByPath.get(relative);
        let matchesDeclared = false;
        try {
          matchesDeclared =
            declared !== undefined &&
            digestAutoMovieBytes(this.project.readGeneratedFile(relative)) ===
              declared.digest;
        } catch {
          matchesDeclared = false;
        }
        diagnostics.push({
          code: matchesDeclared
            ? "generated-stale-output"
            : "generated-unowned",
          category:
            matchesDeclared && repairDeclaredFiles ? "warning" : "error",
          phase: "compile",
          target: relative,
          path: normalizeSlash(path.relative(this.project.root, file)),
          message: matchesDeclared
            ? repairDeclaredFiles
              ? `Generated file "${relative}" belonged to the prior compiler result but is absent from the current result. compileProject will remove it.`
              : `Generated file "${relative}" is stale output from a different compile. Run compileProject to remove it.`
            : `Generated file "${relative}" is not the canonical output derived from current source and design. Remove it before compileProject.`,
        });
      }
    }
    for (const entry of expected.files) {
      const file = path.resolve(this.project.generatedRoot(), entry.path);
      let actual: AutoMovieContentDigest | null = null;
      try {
        actual = digestAutoMovieBytes(
          this.project.readGeneratedFile(entry.path),
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("does not exist"))
          actual = null;
        else {
          diagnostics.push({
            code: "generated-path-outside",
            category: "error",
            phase: "compile",
            target: entry.path,
            path: normalizeSlash(path.relative(this.project.root, file)),
            message:
              error instanceof Error
                ? error.message
                : `Generated file "${entry.path}" is unsafe. Remove the link before compileProject.`,
          });
          continue;
        }
      }
      if (actual !== entry.digest)
        diagnostics.push({
          code: "generated-tampered",
          category: repairDeclaredFiles ? "warning" : "error",
          phase: "compile",
          target: entry.path,
          path: normalizeSlash(path.relative(this.project.root, file)),
          message: repairDeclaredFiles
            ? `Generated digest is ${String(actual)} but current source and design derive ${entry.digest}. compileProject will regenerate this compiler-owned file.`
            : `Generated digest is ${String(actual)} but current source and design derive ${entry.digest}. Run compileProject to regenerate it before accepting lint.`,
        });
    }
    if (
      manifest !== null &&
      manifest.inputFingerprint !== expected.inputFingerprint
    )
      diagnostics.push({
        code: "generated-stale",
        category: repairDeclaredFiles ? "warning" : "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: repairDeclaredFiles
          ? `Generated input ${manifest.inputFingerprint} differs from current ${expected.inputFingerprint}. compileProject will refresh all compiler-owned output.`
          : `Generated input ${manifest.inputFingerprint} differs from current ${expected.inputFingerprint}. Run compileProject before trusting generated output.`,
      });
    if (
      manifest !== null &&
      Buffer.from(canonicalAutoMovieJsonBytes(manifest)).equals(
        Buffer.from(canonicalAutoMovieJsonBytes(expected)),
      ) === false
    )
      diagnostics.push({
        code: "generated-manifest-stale",
        category: repairDeclaredFiles ? "warning" : "error",
        phase: "compile",
        target: "generated-manifest",
        path: generatedManifestPath,
        message: repairDeclaredFiles
          ? "The generated manifest does not exactly match compiler-derived inventory, digests, identity, and provenance. compileProject will replace it."
          : "The generated manifest does not exactly match compiler-derived inventory, digests, identity, and provenance. Run compileProject before trusting generated output.",
      });
    return diagnostics;
  }
}

interface ICompileShotSourceProps {
  id: string;
  path: string;
  exportName: string;
  source: string;
  context: {
    contract: IAutoMovieShotContract;
    models: Readonly<Record<string, unknown>>;
    world: IAutoMovieWorldDesign;
    formations: Readonly<Record<string, unknown>>;
    runtimeModels: Readonly<Record<string, unknown>>;
    formationRuntime: Readonly<Record<string, unknown>>;
    instanceSetRuntime: Readonly<Record<string, unknown>>;
  };
}

interface ICompileShotSourceResult {
  value: IAutoMovieShotSourceOutput | null;
  diagnostics: IAutoMovieDiagnostic[];
}

interface ICompileDeterministicSourceProps<T> {
  target: string;
  label: string;
  path: string;
  exportName: string;
  source: string;
  context: unknown;
  /** Expected defineShot registration id, when compiling one shot module. */
  registrationId?: string;
  validate(input: unknown): IValidation<T>;
}

interface ICompileDeterministicSourceResult<T> {
  value: T | null;
  diagnostics: IAutoMovieDiagnostic[];
}

const SANDBOX_BOOTSTRAP = `
(() => {
  "use strict";
  const automovieModule = { exports: {} };
  Object.defineProperty(globalThis, "module", {
    value: automovieModule,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(globalThis, "exports", {
    value: automovieModule.exports,
    writable: false,
    configurable: false,
  });
  const quiet = () => undefined;
  Object.defineProperty(globalThis, "console", {
    value: Object.freeze({ log: quiet, warn: quiet, error: quiet }),
    writable: false,
    configurable: false,
  });
  for (const [prototype, names] of [
    [String.prototype, ["localeCompare", "toLocaleLowerCase", "toLocaleUpperCase"]],
    [Number.prototype, ["toLocaleString"]],
    [BigInt.prototype, ["toLocaleString"]],
    [Array.prototype, ["toLocaleString"]],
    [Date.prototype, ["toLocaleDateString", "toLocaleString", "toLocaleTimeString"]],
  ])
    for (const name of names)
      Object.defineProperty(prototype, name, {
        value: undefined,
        writable: false,
        configurable: false,
      });
  for (const name of [
    "Date",
    "Intl",
    "process",
    "require",
    "fetch",
    "Promise",
    "queueMicrotask",
    "setTimeout",
    "setInterval",
    "performance",
    "crypto",
    "Intl",
    "Temporal",
  ])
    Object.defineProperty(globalThis, name, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  Object.defineProperty(Math, "random", {
    value: () => {
      throw new Error("Math.random is unavailable in deterministic shot source.");
    },
    writable: false,
    configurable: false,
  });
  const parse = JSON.parse;
  const stringify = JSON.stringify;
  const values = Object.values;
  const freeze = (value) => {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const child of values(value)) freeze(child);
    }
    return value;
  };
  const hypot = Math.hypot;
  const mixSeed = (seed, salt) => {
    const integer = Math.trunc(seed);
    const low = integer >>> 0;
    const high = Math.floor(integer / 4294967296) >>> 0;
    let value = (salt ^ low) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
    value = Math.imul(value ^ (value >>> 15) ^ high, 0x846ca68b);
    return (value ^ (value >>> 16)) >>> 0;
  };
  const seededValue = (...items) => {
    let state = 0x9e3779b9;
    for (const item of items) state = mixSeed(item, state);
    state = (state + 0x6d2b79f5) >>> 0;
    let output = state;
    output = Math.imul(output ^ (output >>> 15), output | 1);
    output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
  const formationSlot = (data, formationId, slot) => {
    const formation = data.formationRuntime[formationId];
    if (
      formation === undefined ||
      Number.isSafeInteger(slot) === false ||
      slot < 0 ||
      slot >= formation.count
    )
      throw new RangeError(
        'Formation "' + formationId + '" slot ' + slot + " is unavailable.",
      );
    const layout = formation.layout;
    let x;
    let z;
    if (layout.kind === "line" || layout.kind === "column") {
      const rank =
        layout.kind === "line"
          ? Math.floor(slot / layout.files)
          : slot % layout.ranks;
      const file =
        layout.kind === "line"
          ? slot % layout.files
          : Math.floor(slot / layout.ranks);
      x = (file - (layout.files - 1) / 2) * layout.spacing.lateral;
      z = rank * layout.spacing.depth;
    } else if (layout.kind === "wedge") {
      const row = Math.floor(Math.sqrt(slot));
      x = (slot - row * row - row) * layout.spacing.lateral;
      z = row * layout.spacing.depth;
    } else if (layout.kind === "arc") {
      const ratio =
        formation.count === 1 ? 0.5 : slot / (formation.count - 1);
      const radians =
        (((ratio - 0.5) * layout.arcDegrees) / 180) * Math.PI;
      x = Math.sin(radians) * layout.radius;
      z = Math.cos(radians) * layout.radius;
    } else {
      const radius =
        Math.sqrt(
          seededValue(formation.seed, layout.seed, slot, 0),
        ) * layout.radius;
      const angle =
        seededValue(formation.seed, layout.seed, slot, 1) * Math.PI * 2;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    }
    const radians = (formation.facingDeg * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const hero = formation.heroes.find((item) => item.slot === slot);
    return freeze({
      slot,
      node:
        hero?.actor ??
        "formation:" +
          formation.id +
          ":slot:" +
          String(slot).padStart(6, "0"),
      actor: hero?.actor ?? null,
      modelRecipe: formation.modelRecipe,
      position: {
        x: formation.anchor.x + x * cosine + z * sine,
        y: formation.anchor.y,
        z: formation.anchor.z - x * sine + z * cosine,
      },
      facingDeg: formation.facingDeg,
      motionPhase: seededValue(formation.seed, slot, 0x70686173),
    });
  };
  const instanceSlot = (data, instanceSetId, slot) => {
    const instanceSet = data.instanceSetRuntime[instanceSetId];
    if (
      instanceSet === undefined ||
      Number.isSafeInteger(slot) === false ||
      slot < 0 ||
      slot >= instanceSet.count
    )
      throw new RangeError(
        'Instance set "' +
          instanceSetId +
          '" slot ' +
          slot +
          " is unavailable.",
      );
    const layout = instanceSet.layout;
    let x;
    let z;
    if (layout.kind === "grid") {
      const row = Math.floor(slot / layout.columns);
      const column = slot % layout.columns;
      x = (column - (layout.columns - 1) / 2) * layout.spacing.x;
      z = row * layout.spacing.z;
    } else if (layout.kind === "scatter") {
      const radius =
        Math.sqrt(seededValue(instanceSet.seed, slot, 0x72616469)) *
        layout.radius;
      const angle =
        seededValue(instanceSet.seed, slot, 0x616e676c) * Math.PI * 2;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
    } else {
      const route = instanceSet.route;
      if (route === null || route.waypoints.length < 2)
        throw new Error(
          'Instance set "' +
            instanceSetId +
            '" route "' +
            layout.route +
            '" is unavailable.',
        );
      const segments = route.waypoints.slice(1).map((right, index) => {
        const left = route.waypoints[index];
        return {
          left,
          right,
          length: hypot(right.x - left.x, right.z - left.z),
        };
      });
      const total = segments.reduce(
        (sum, segment) => sum + segment.length,
        0,
      );
      let remaining = ((slot + 0.5) / instanceSet.count) * total;
      let segment = segments[segments.length - 1];
      for (const candidate of segments) {
        segment = candidate;
        if (remaining <= candidate.length) break;
        remaining -= candidate.length;
      }
      const ratio =
        segment.length === 0
          ? 0
          : Math.min(1, remaining / segment.length);
      const tangentX = segment.right.x - segment.left.x;
      const tangentZ = segment.right.z - segment.left.z;
      const tangentLength = hypot(tangentX, tangentZ);
      const jitter =
        (seededValue(instanceSet.seed, slot, 0x6a697474) * 2 - 1) *
        layout.lateralJitter;
      x =
        segment.left.x +
        tangentX * ratio -
        (tangentLength === 0 ? 0 : (tangentZ / tangentLength) * jitter);
      z =
        segment.left.z +
        tangentZ * ratio +
        (tangentLength === 0 ? 0 : (tangentX / tangentLength) * jitter);
    }
    const radians = (instanceSet.facingDeg * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const scaleRatio = seededValue(
      instanceSet.seed,
      slot,
      0x7363616c,
    );
    const scale =
      instanceSet.variation.scale.min * (1 - scaleRatio) +
      instanceSet.variation.scale.max * scaleRatio;
    const paletteIndex = Math.min(
      instanceSet.variation.palette.length - 1,
      Math.floor(
        seededValue(instanceSet.seed, slot, 0x70616c65) *
          instanceSet.variation.palette.length,
      ),
    );
    const traits = {};
    instanceSet.variation.traits.forEach((trait, index) => {
      const ratio = seededValue(
        instanceSet.seed,
        slot,
        index,
        0x74726169,
      );
      Object.defineProperty(traits, trait.name, {
        configurable: true,
        enumerable: true,
        value: trait.min * (1 - ratio) + trait.max * ratio,
        writable: true,
      });
    });
    return freeze({
      slot,
      node:
        "instance:" +
        instanceSet.id +
        ":slot:" +
        String(slot).padStart(6, "0"),
      modelRecipe: instanceSet.modelRecipe,
      position:
        layout.kind === "along-route"
          ? { x, y: instanceSet.anchor.y, z }
          : {
              x: instanceSet.anchor.x + x * cosine + z * sine,
              y: instanceSet.anchor.y,
              z: instanceSet.anchor.z - x * sine + z * cosine,
            },
      facingDeg: instanceSet.facingDeg,
      scale,
      palette: instanceSet.variation.palette[paletteIndex],
      traits,
    });
  };
  const insidePolygon = (point, polygon) => {
    let inside = false;
    for (
      let index = 0, previous = polygon.length - 1;
      index < polygon.length;
      previous = index++
    ) {
      const currentPoint = polygon[index];
      const previousPoint = polygon[previous];
      if (
        (currentPoint.z > point.z) !== (previousPoint.z > point.z) &&
        point.x <
          ((previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)) /
            (previousPoint.z - currentPoint.z) +
            currentPoint.x
      )
        inside = !inside;
    }
    return inside;
  };
  const invoke = (contextJson, exportName) => {
    const data = parse(contextJson);
    const engine = Object.freeze({
      distance: (left, right) =>
        hypot(left.x - right.x, left.y - right.y, left.z - right.z),
      groundHeight: (point) => {
        for (const surface of data.world.surfaces)
          if (insidePolygon(point, surface.polygon))
            return surface.height.kind === "constant"
              ? surface.height.value
              : surface.height.originHeight +
                  surface.height.slopeX * point.x +
                  surface.height.slopeZ * point.z;
        return 0;
      },
      formationSlot: (formation, slot) =>
        formationSlot(data, formation, slot),
      instanceSlot: (instanceSet, slot) =>
        instanceSlot(data, instanceSet, slot),
    });
    const context = freeze({ ...data, engine });
    const result = automovieModule.exports[exportName].build(context);
    const returnedPromise =
      typeof result === "object" &&
      result !== null &&
      typeof result.then === "function";
    const serialized = returnedPromise ? null : stringify(result);
    return {
      returnedPromise,
      resultJson: typeof serialized === "string" ? serialized : null,
    };
  };
  Object.defineProperty(globalThis, "__automovieInvoke", {
    value: invoke,
    writable: false,
    configurable: false,
  });
  Object.freeze(Math);
  Object.freeze(JSON);
})();
`;

const SOURCE_INVOCATION = `
(() => {
  "use strict";
  const snapshot = __automovieInvoke(
    __automovieContextJson,
    __automovieExportName,
  );
  globalThis.__automovieReturnedPromise = snapshot.returnedPromise;
  globalThis.__automovieResultJson = snapshot.resultJson;
  delete globalThis.__automovieContextJson;
  delete globalThis.__automovieExportName;
})();
`;

const compileShotSource = (
  props: ICompileShotSourceProps,
): ICompileShotSourceResult =>
  compileDeterministicSource({
    ...props,
    target: `shot:${props.id}`,
    label: "compiled shot",
    registrationId: props.id,
    validate: (input) =>
      typia.validateEquals<IAutoMovieShotSourceOutput>(input),
  });

const compileDeterministicSource = <T>(
  props: ICompileDeterministicSourceProps<T>,
): ICompileDeterministicSourceResult<T> => {
  const diagnostics = inspectSource(props.target, props.path, props.source);
  if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
    return { value: null, diagnostics };
  const transpiled = ts.transpileModule(props.source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      isolatedModules: true,
    },
    fileName: props.path,
    reportDiagnostics: true,
  });
  for (const diagnostic of transpiled.diagnostics!)
    if (diagnostic.category === ts.DiagnosticCategory.Error)
      diagnostics.push({
        code: "source-transpile-failed",
        category: "error",
        phase: "source",
        target: props.target,
        path: props.path,
        message: `${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")} Fix ${props.path} before compileProject.`,
      });
  if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
    return { value: null, diagnostics };
  const sandbox = vm.createContext(
    {},
    {
      codeGeneration: { strings: false, wasm: false },
      microtaskMode: "afterEvaluate",
      name: `automovie:${props.target}`,
    },
  );
  try {
    new vm.Script(SANDBOX_BOOTSTRAP, {
      filename: `${props.path}#sandbox`,
    }).runInContext(sandbox, { timeout: 1_000 });
    new vm.Script(transpiled.outputText, {
      filename: props.path,
    }).runInContext(sandbox, { timeout: 1_000 });
    sandbox.__automovieExportName = props.exportName;
    new vm.Script(
      `globalThis.__automovieExportValid =
        typeof module.exports[__automovieExportName]?.build === "function";
       delete globalThis.__automovieExportName;`,
      { filename: `${props.path}#export` },
    ).runInContext(sandbox, { timeout: 1_000 });
    if (sandbox.__automovieExportValid !== true)
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          {
            code: "source-export-missing",
            category: "error",
            phase: "source",
            target: props.target,
            path: props.path,
            message: `Export "${props.exportName}" with a build(context) function was not found. Add that named export to ${props.path}.`,
          },
        ],
      };
    if (props.registrationId !== undefined) {
      sandbox.__automovieExportName = props.exportName;
      new vm.Script(
        `globalThis.__automovieRegistrationId = (() => {
           const candidate = module.exports[__automovieExportName]?.id;
           return typeof candidate === "string" ? candidate : null;
         })();
         delete globalThis.__automovieExportName;`,
        { filename: `${props.path}#registration` },
      ).runInContext(sandbox, { timeout: 1_000 });
      const registrationId = sandbox.__automovieRegistrationId as unknown;
      if (
        typeof registrationId !== "string" ||
        registrationId !== props.registrationId
      )
        return {
          value: null,
          diagnostics: [
            ...diagnostics,
            {
              code: "source-registration-mismatch",
              category: "error",
              phase: "source",
              target: props.target,
              path: props.path,
              message:
                typeof registrationId === "string"
                  ? `Contract id "${props.registrationId}" points to export "${props.exportName}" in ${props.path}, but the source registered "${registrationId}". Change the contract pointer or registration so module path, named export and id identify one artifact.`
                  : `Contract id "${props.registrationId}" points to export "${props.exportName}" in ${props.path}, but that export has no string id. Add id: "${props.registrationId}" to the exported IAutoMovieShotSource so module path, named export and id identify one artifact.`,
            },
          ],
        };
    }
    sandbox.__automovieContextJson = JSON.stringify(props.context);
    sandbox.__automovieExportName = props.exportName;
    new vm.Script(SOURCE_INVOCATION, {
      filename: `${props.path}#${props.exportName}`,
    }).runInContext(sandbox, { timeout: 1_000 });
    if (sandbox.__automovieReturnedPromise === true)
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          {
            code: "source-export-invalid",
            category: "error",
            phase: "source",
            target: props.target,
            path: props.path,
            message: `Export "${props.exportName}" returned a Promise. Return a synchronous deterministic ${props.label} from ${props.path}.`,
          },
        ],
      };
    const resultJson = sandbox.__automovieResultJson as unknown;
    const value =
      typeof resultJson === "string" ? JSON.parse(resultJson) : undefined;
    const validation = props.validate(value);
    if (validation.success === false)
      return {
        value: null,
        diagnostics: [
          ...diagnostics,
          ...validation.errors.map(
            (error): IAutoMovieDiagnostic => ({
              code: "source-export-invalid",
              category: "error",
              phase: "source",
              target: props.target,
              path: props.path,
              message: `${error.path} expects ${error.expected}. Fix the returned ${props.label} in ${props.path}.`,
            }),
          ),
        ],
      };
    return { value: validation.data, diagnostics };
  } catch (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
    return {
      value: null,
      diagnostics: [
        ...diagnostics,
        {
          code: message.includes("timed out")
            ? "source-execution-timeout"
            : "source-execution-failed",
          category: "error",
          phase: "source",
          target: props.target,
          path: props.path,
          message: `Source export "${props.exportName}" in ${props.path} failed while building ${props.label}: ${message}. No generated artifact was published. Correct the operation or precondition named by this fact, then rerun the same compile scope.`,
        },
      ],
    };
  }
};

interface ICompiledFilmDraft {
  edit: IAutoMovieFilmEdit;
  timeline: Omit<
    IAutoMovieFilmTimeline,
    "compiler" | "inputFingerprint" | "sourceDigest"
  >;
}

interface ICompileFilmSourceProps {
  source: string;
  context: IAutoMovieFilmBuildContext;
  contracts: ReadonlyMap<string, IAutoMovieShotContract>;
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>;
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>;
}

const compileFilmSource = (
  props: ICompileFilmSourceProps,
): ICompileDeterministicSourceResult<ICompiledFilmDraft> => {
  const source = compileDeterministicSource<IAutoMovieFilmEdit>({
    target: "film",
    label: "film edit",
    path: FILM_SOURCE_PATH,
    exportName: FILM_SOURCE_EXPORT,
    source: props.source,
    context: props.context,
    validate: (input) => typia.validateEquals<IAutoMovieFilmEdit>(input),
  });
  if (source.value === null)
    return { value: null, diagnostics: source.diagnostics };
  const diagnostics = [...source.diagnostics];
  const edit = source.value;
  const fps = props.context.production.frameFormat.fps;
  const targetFrames = frameTime(
    { seconds: props.context.production.targetRuntimeSeconds },
    fps,
    "production target runtime",
    diagnostics,
  );
  if (edit.id !== props.context.production.id)
    diagnostics.push(
      filmDiagnostic(
        "film-id-mismatch",
        `Film id "${edit.id}" differs from production id "${props.context.production.id}". Return the current production id from ${FILM_SOURCE_PATH}.`,
      ),
    );
  const omitted = new Set<string>();
  for (const omission of edit.omissions) {
    if (
      omission.shot.trim().length === 0 ||
      omission.reason.trim().length === 0 ||
      omitted.has(omission.shot)
    )
      diagnostics.push(
        filmDiagnostic(
          "film-shot-accounting-invalid",
          `Omission "${omission.shot}" must name one unique current shot with a non-blank reason.`,
        ),
      );
    else omitted.add(omission.shot);
    if (props.contracts.has(omission.shot) === false)
      diagnostics.push(
        filmDiagnostic(
          "film-shot-unknown",
          `Omission "${omission.shot}" is not a current shot contract. Remove it or restore that contract.`,
        ),
      );
  }
  const used = new Set<string>();
  const segments: IAutoMovieFilmTimeline["segments"] = [];
  for (const placement of edit.tracks.video) {
    const contract = props.contracts.get(placement.shot);
    if (
      placement.shot.trim().length === 0 ||
      used.has(placement.shot) ||
      omitted.has(placement.shot)
    )
      diagnostics.push(
        filmDiagnostic(
          "film-shot-accounting-invalid",
          `Video shot "${placement.shot}" must appear once and cannot also be omitted.`,
        ),
      );
    else used.add(placement.shot);
    if (contract === undefined) {
      diagnostics.push(
        filmDiagnostic(
          "film-shot-unknown",
          `Video shot "${placement.shot}" is not a current shot contract.`,
        ),
      );
      continue;
    }
    if (
      props.compiled.has(placement.shot) === false ||
      props.realizations.has(placement.shot) === false
    )
      diagnostics.push(
        filmDiagnostic(
          "film-shot-not-compiled",
          `Shot "${placement.shot}" has no current compiled source and realization. Correct that shot before compiling the film.`,
        ),
      );
    const sourceInFrame = frameTime(
      placement.sourceIn,
      fps,
      `${placement.shot} sourceIn`,
      diagnostics,
    );
    const sourceOutFrame = frameTime(
      placement.sourceOut,
      fps,
      `${placement.shot} sourceOut`,
      diagnostics,
    );
    const startFrame = frameTime(
      placement.start,
      fps,
      `${placement.shot} global start`,
      diagnostics,
    );
    const headHandleFrames = frameTime(
      placement.handles.head,
      fps,
      `${placement.shot} head handle`,
      diagnostics,
    );
    const tailHandleFrames = frameTime(
      placement.handles.tail,
      fps,
      `${placement.shot} tail handle`,
      diagnostics,
    );
    const transitionIn = normalizeFilmTransition(
      placement.transitionIn,
      fps,
      `${placement.shot} transitionIn`,
      diagnostics,
    );
    const transitionOut = normalizeFilmTransition(
      placement.transitionOut,
      fps,
      `${placement.shot} transitionOut`,
      diagnostics,
    );
    const shotFrames = frameTime(
      { seconds: contract.durationSeconds },
      fps,
      `${placement.shot} contract duration`,
      diagnostics,
    );
    if (
      sourceInFrame === null ||
      sourceOutFrame === null ||
      startFrame === null ||
      headHandleFrames === null ||
      tailHandleFrames === null ||
      transitionIn === null ||
      transitionOut === null ||
      shotFrames === null
    )
      continue;
    if (
      sourceOutFrame <= sourceInFrame ||
      sourceOutFrame > shotFrames ||
      headHandleFrames > sourceOutFrame - sourceInFrame ||
      tailHandleFrames > sourceOutFrame - sourceInFrame
    )
      diagnostics.push(
        filmDiagnostic(
          "film-source-range-invalid",
          `Shot "${placement.shot}" source range ${sourceInFrame}..${sourceOutFrame} and handles ${headHandleFrames}/${tailHandleFrames} must fit its ${shotFrames}-frame contract.`,
        ),
      );
    segments.push({
      shot: placement.shot,
      sourceInFrame,
      sourceOutFrame,
      startFrame,
      endFrame: startFrame + sourceOutFrame - sourceInFrame,
      headHandleFrames,
      tailHandleFrames,
      transitionIn,
      transitionOut,
    });
  }
  for (const shot of props.contracts.keys())
    if (used.has(shot) === false && omitted.has(shot) === false)
      diagnostics.push(
        filmDiagnostic(
          "film-shot-unaccounted",
          `Shot "${shot}" is neither placed nor explicitly omitted. Account for every current narrative shot.`,
        ),
      );
  validateVideoTimeline(segments, props, fps, diagnostics);
  const totalFrames =
    segments.length === 0
      ? 0
      : Math.max(...segments.map((item) => item.endFrame));
  if (targetFrames !== null && totalFrames !== targetFrames)
    diagnostics.push(
      filmDiagnostic(
        "film-runtime-mismatch",
        `Film timeline ends at frame ${totalFrames}, but production target runtime is frame ${targetFrames}. Correct placement timing or production runtime.`,
      ),
    );
  const audio = normalizeAudioCues(
    edit,
    props.context.assets,
    fps,
    totalFrames,
    diagnostics,
  );
  const captions = normalizeCaptionCues(edit, fps, totalFrames, diagnostics);
  const effects = normalizeEffectCues(
    edit,
    props.context.effectZones.map((zone) => zone.id),
    fps,
    totalFrames,
    diagnostics,
  );
  return {
    value: diagnostics.some((diagnostic) => diagnostic.category === "error")
      ? null
      : {
          edit,
          timeline: {
            version: 1,
            id: edit.id,
            fps,
            totalFrames,
            segments,
            omissions: edit.omissions,
            tracks: { audio, captions, effects },
          },
        },
    diagnostics,
  };
};

const filmDiagnostic = (
  code: string,
  message: string,
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase: "compile",
  target: "film",
  path: FILM_SOURCE_PATH,
  message,
});

const frameTime = (
  value: { frame: number } | { seconds: number },
  fps: number,
  label: string,
  diagnostics: IAutoMovieDiagnostic[],
): number | null => {
  const raw = "frame" in value ? value.frame : value.seconds * fps;
  const rounded = Math.round(raw);
  if (
    Number.isFinite(raw) === false ||
    Number.isSafeInteger(rounded) === false ||
    rounded < 0 ||
    Math.abs(raw - rounded) > Number.EPSILON * 64 * Math.max(1, Math.abs(raw))
  ) {
    diagnostics.push(
      filmDiagnostic(
        "film-time-off-grid",
        `${label} does not resolve to one non-negative safe production frame at ${fps} fps. Use an exact frame or frame-grid second.`,
      ),
    );
    return null;
  }
  return rounded;
};

const normalizeFilmTransition = (
  transition: IAutoMovieFilmEdit["tracks"]["video"][number]["transitionIn"],
  fps: number,
  label: string,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["segments"][number]["transitionIn"] | null => {
  if (transition.kind === "cut") return { kind: "cut" };
  const durationFrames = frameTime(
    transition.duration,
    fps,
    `${label} duration`,
    diagnostics,
  );
  if (durationFrames === null) return null;
  if (durationFrames === 0) {
    diagnostics.push(
      filmDiagnostic(
        "film-transition-invalid",
        `${label} ${transition.kind} duration must be at least one frame.`,
      ),
    );
    return null;
  }
  return { kind: transition.kind, durationFrames };
};

const transitionDuration = (
  transition: IAutoMovieFilmTimeline["segments"][number]["transitionIn"],
): number => ("durationFrames" in transition ? transition.durationFrames : 0);

const validateVideoTimeline = (
  segments: readonly IAutoMovieFilmTimeline["segments"][number][],
  props: ICompileFilmSourceProps,
  fps: number,
  diagnostics: IAutoMovieDiagnostic[],
): void => {
  if (segments.length === 0) {
    diagnostics.push(
      filmDiagnostic(
        "film-video-empty",
        "The finished film must contain at least one current video placement.",
      ),
    );
    return;
  }
  if (segments[0]!.startFrame !== 0)
    diagnostics.push(
      filmDiagnostic(
        "film-global-order-invalid",
        `The first video placement starts at frame ${segments[0]!.startFrame}; it must start at frame 0.`,
      ),
    );
  for (let index = 0; index < segments.length; ++index) {
    const segment = segments[index]!;
    if (
      (index === 0 && segment.transitionIn.kind === "dissolve") ||
      (index === segments.length - 1 &&
        segment.transitionOut.kind === "dissolve")
    )
      diagnostics.push(
        filmDiagnostic(
          "film-transition-invalid",
          `Shot "${segment.shot}" cannot dissolve beyond the beginning or end of the film.`,
        ),
      );
    for (const [side, transition, handle] of [
      ["incoming", segment.transitionIn, segment.headHandleFrames],
      ["outgoing", segment.transitionOut, segment.tailHandleFrames],
    ] as const)
      if (
        transition.kind !== "cut" &&
        transitionDuration(transition) >
          (transition.kind === "dissolve"
            ? handle
            : segment.endFrame - segment.startFrame)
      )
        diagnostics.push(
          filmDiagnostic(
            "film-transition-handle-missing",
            `Shot "${segment.shot}" ${side} ${transition.kind} needs ${transitionDuration(transition)} frames, but only ${handle} transition-handle frames are declared.`,
          ),
        );
    if (index === 0) continue;
    const previous = segments[index - 1]!;
    if (
      previous.transitionOut.kind !== segment.transitionIn.kind ||
      transitionDuration(previous.transitionOut) !==
        transitionDuration(segment.transitionIn)
    )
      diagnostics.push(
        filmDiagnostic(
          "film-transition-mismatch",
          `Transition between "${previous.shot}" and "${segment.shot}" must have identical outgoing and incoming kind/duration.`,
        ),
      );
    const overlap =
      previous.transitionOut.kind === "dissolve"
        ? transitionDuration(previous.transitionOut)
        : 0;
    const expectedStart = previous.endFrame - overlap;
    if (segment.startFrame !== expectedStart)
      diagnostics.push(
        filmDiagnostic(
          "film-global-order-invalid",
          `Shot "${segment.shot}" starts at frame ${segment.startFrame}; transition law requires frame ${expectedStart}. Arbitrary gaps and overlaps are forbidden.`,
        ),
      );
    validateStateContinuity(previous, segment, props, fps, diagnostics);
  }
};

const validateStateContinuity = (
  previous: IAutoMovieFilmTimeline["segments"][number],
  current: IAutoMovieFilmTimeline["segments"][number],
  props: ICompileFilmSourceProps,
  fps: number,
  diagnostics: IAutoMovieDiagnostic[],
): void => {
  const previousContract = props.contracts.get(previous.shot)!;
  const currentContract = props.contracts.get(current.shot)!;
  const previousFrames = Math.round(previousContract.durationSeconds * fps);
  if (
    previous.sourceOutFrame !== previousFrames ||
    current.sourceInFrame !== 0
  ) {
    if (
      previousContract.closing.length !== 0 ||
      currentContract.opening.length !== 0
    )
      diagnostics.push(
        filmDiagnostic(
          "film-state-handoff-unverifiable",
          `Trimmed boundary "${previous.shot}" -> "${current.shot}" cannot use contract edge-state continuity. Author full contract edges or remove edge-state claims.`,
        ),
      );
    return;
  }
  const previousRealization = props.realizations.get(previous.shot);
  const currentRealization = props.realizations.get(current.shot);
  if (previousRealization === undefined || currentRealization === undefined)
    return;
  const closing = previousRealization.closing.map((state) => state.predicates);
  const opening = currentRealization.opening.map((state) => state.predicates);
  if (
    Buffer.from(canonicalAutoMovieJsonBytes(closing)).equals(
      Buffer.from(canonicalAutoMovieJsonBytes(opening)),
    ) === false
  )
    diagnostics.push(
      filmDiagnostic(
        "film-state-handoff-mismatch",
        `Closing state of "${previous.shot}" does not equal opening state of "${current.shot}". Correct the adjacent shot predicates or edit boundary.`,
      ),
    );
};

const normalizeAudioCues = (
  edit: IAutoMovieFilmEdit,
  assets: readonly string[],
  fps: number,
  totalFrames: number,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["tracks"]["audio"] => {
  const output: IAutoMovieFilmTimeline["tracks"]["audio"] = [];
  const ids = new Set<string>();
  let priorStart = -1;
  for (const cue of edit.tracks.audio) {
    const sourceDurationFrames = frameTime(
      cue.sourceDuration,
      fps,
      `${cue.id} audio source duration`,
      diagnostics,
    );
    const sourceOffsetFrame = frameTime(
      cue.sourceOffset,
      fps,
      `${cue.id} audio source offset`,
      diagnostics,
    );
    const startFrame = frameTime(
      cue.start,
      fps,
      `${cue.id} audio start`,
      diagnostics,
    );
    const durationFrames = frameTime(
      cue.duration,
      fps,
      `${cue.id} audio duration`,
      diagnostics,
    );
    const fadeInFrames = frameTime(
      cue.fadeIn,
      fps,
      `${cue.id} audio fadeIn`,
      diagnostics,
    );
    const fadeOutFrames = frameTime(
      cue.fadeOut,
      fps,
      `${cue.id} audio fadeOut`,
      diagnostics,
    );
    if (
      sourceDurationFrames === null ||
      sourceOffsetFrame === null ||
      startFrame === null ||
      durationFrames === null ||
      fadeInFrames === null ||
      fadeOutFrames === null
    )
      continue;
    if (
      cue.id.trim().length === 0 ||
      ids.has(cue.id) ||
      assets.includes(cue.asset) === false ||
      sourceDurationFrames === 0 ||
      durationFrames === 0 ||
      sourceOffsetFrame + durationFrames > sourceDurationFrames ||
      startFrame + durationFrames > totalFrames ||
      fadeInFrames + fadeOutFrames > durationFrames ||
      Number.isFinite(cue.gain) === false ||
      cue.gain < 0 ||
      cue.gain > 4 ||
      startFrame < priorStart
    )
      diagnostics.push(
        filmDiagnostic(
          "film-audio-cue-invalid",
          `Audio cue "${cue.id}" must be unique, ordered, in film/source range, reference a present declared asset, use fades within duration, and set gain from 0 through 4.`,
        ),
      );
    ids.add(cue.id);
    priorStart = startFrame;
    output.push({
      id: cue.id,
      asset: cue.asset,
      sourceDurationFrames,
      sourceOffsetFrame,
      startFrame,
      durationFrames,
      gain: cue.gain,
      fadeInFrames,
      fadeOutFrames,
      bus: cue.bus,
    });
  }
  return output;
};

const normalizeCaptionCues = (
  edit: IAutoMovieFilmEdit,
  fps: number,
  totalFrames: number,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["tracks"]["captions"] => {
  const output: IAutoMovieFilmTimeline["tracks"]["captions"] = [];
  const ids = new Set<string>();
  let priorEnd = 0;
  for (const cue of edit.tracks.captions) {
    const startFrame = frameTime(
      cue.start,
      fps,
      `${cue.id} caption start`,
      diagnostics,
    );
    const endFrame = frameTime(
      cue.end,
      fps,
      `${cue.id} caption end`,
      diagnostics,
    );
    if (startFrame === null || endFrame === null) continue;
    if (
      cue.id.trim().length === 0 ||
      ids.has(cue.id) ||
      cue.text.trim().length === 0 ||
      /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(cue.language) === false ||
      cue.speaker?.trim().length === 0 ||
      startFrame < priorEnd ||
      endFrame <= startFrame ||
      endFrame > totalFrames
    )
      diagnostics.push(
        filmDiagnostic(
          "film-caption-cue-invalid",
          `Caption cue "${cue.id}" must be unique, non-overlapping, in range, plain non-blank text, and use a non-blank language/speaker identity.`,
        ),
      );
    ids.add(cue.id);
    priorEnd = endFrame;
    output.push({
      id: cue.id,
      text: cue.text,
      language: cue.language,
      ...(cue.speaker === undefined ? {} : { speaker: cue.speaker }),
      startFrame,
      endFrame,
    });
  }
  return output;
};

const normalizeEffectCues = (
  edit: IAutoMovieFilmEdit,
  zones: readonly string[],
  fps: number,
  totalFrames: number,
  diagnostics: IAutoMovieDiagnostic[],
): IAutoMovieFilmTimeline["tracks"]["effects"] => {
  const output: IAutoMovieFilmTimeline["tracks"]["effects"] = [];
  const ids = new Set<string>();
  let priorStart = -1;
  for (const cue of edit.tracks.effects) {
    const startFrame = frameTime(
      cue.start,
      fps,
      `${cue.id} effect start`,
      diagnostics,
    );
    const durationFrames = frameTime(
      cue.duration,
      fps,
      `${cue.id} effect duration`,
      diagnostics,
    );
    if (startFrame === null || durationFrames === null) continue;
    if (
      cue.id.trim().length === 0 ||
      ids.has(cue.id) ||
      zones.includes(cue.zone) === false ||
      durationFrames === 0 ||
      startFrame + durationFrames > totalFrames ||
      cue.intensity < 0 ||
      cue.intensity > 1 ||
      startFrame < priorStart
    )
      diagnostics.push(
        filmDiagnostic(
          "film-effect-cue-invalid",
          `Effect cue "${cue.id}" must be unique, ordered, in range, reference a registered world zone, and use intensity from 0 through 1.`,
        ),
      );
    ids.add(cue.id);
    priorStart = startFrame;
    output.push({
      id: cue.id,
      recipe: cue.recipe,
      zone: cue.zone,
      startFrame,
      durationFrames,
      intensity: cue.intensity,
    });
  }
  return output;
};

const inspectSource = (
  target: string,
  sourcePath: string,
  source: string,
): IAutoMovieDiagnostic[] => {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const found = new Set<string>();
  const report = (code: string, capability: string): void => {
    const key = `${code}:${capability}`;
    if (found.has(key)) return;
    found.add(key);
    diagnostics.push({
      code,
      category: "error",
      phase: "source",
      target,
      path: sourcePath,
      message: `${capability} is unavailable in deterministic shot source. Replace it with design input, an explicit seed, or an AutoMovie engine oracle in ${sourcePath}.`,
    });
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.canHaveModifiers(node) &&
      ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)
    )
      report("source-capability-forbidden", "async function");
    if (
      ts.isImportDeclaration(node) &&
      importDeclarationHasRuntimeBinding(node)
    )
      report("source-import-unsupported", "runtime import");
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    )
      report("source-import-unsupported", "dynamic import");
    if (ts.isPropertyAccessExpression(node)) {
      const expression = node.expression.getText(sourceFile);
      const name = node.name.text;
      if (LOCALE_SENSITIVE_SOURCE_MEMBERS.has(name))
        report("source-nondeterministic", name);
      if (
        (expression === "Math" && name === "random") ||
        (expression === "Date" && name === "now") ||
        (expression === "performance" && name === "now") ||
        (expression === "crypto" && name === "randomUUID")
      )
        report("source-nondeterministic", `${expression}.${name}`);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      LOCALE_SENSITIVE_SOURCE_MEMBERS.has(node.argumentExpression.text)
    )
      report("source-nondeterministic", node.argumentExpression.text);
    if (
      ts.isIdentifier(node) &&
      [
        "Date",
        "Intl",
        "process",
        "require",
        "fetch",
        "Promise",
        "queueMicrotask",
        "setTimeout",
        "setInterval",
      ].includes(node.text) &&
      (ts.isPropertyAccessExpression(node.parent) === false ||
        node.parent.name !== node)
    )
      report("source-capability-forbidden", node.text);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return diagnostics;
};

const importDeclarationHasRuntimeBinding = (
  declaration: ts.ImportDeclaration,
): boolean => {
  const clause = declaration.importClause;
  if (clause === undefined) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name !== undefined) return true;
  const bindings = clause.namedBindings!;
  if (ts.isNamespaceImport(bindings)) return true;
  return bindings.elements.some((element) => element.isTypeOnly === false);
};

const LOCALE_SENSITIVE_SOURCE_MEMBERS = new Set([
  "localeCompare",
  "toLocaleDateString",
  "toLocaleLowerCase",
  "toLocaleString",
  "toLocaleTimeString",
  "toLocaleUpperCase",
]);

const validateCompiledShot = (
  contract: IAutoMovieShotContract,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const id = contract.id;
  const diagnostics: IAutoMovieDiagnostic[] = [];
  if (value.shot.id !== id)
    diagnostics.push(
      engineDiagnostic(id, "shot.id", `must equal contract id "${id}"`),
    );
  if (value.shot.duration !== contract.durationSeconds)
    diagnostics.push(
      engineDiagnostic(
        id,
        "shot.duration",
        `must equal contract duration ${contract.durationSeconds}`,
      ),
    );
  appendValidation(
    diagnostics,
    id,
    validateSceneArtifact(value.scene, value.models),
  );
  const motionIds = new Set(value.motions.map((motion) => motion.id));
  appendValidation(
    diagnostics,
    id,
    validateShotArtifact(value.shot, value.scene, motionIds),
  );
  diagnostics.push(...validateAutoMovieFormationMotions(contract, value));
  diagnostics.push(...validateAutoMovieEffects(contract, value));
  for (const model of value.models)
    appendValidation(diagnostics, id, validateModel({ model }));
  const skeletons = new Map(
    value.models.flatMap((model) =>
      model.skeleton === null
        ? []
        : [[model.skeleton.id, model.skeleton] as const],
    ),
  );
  for (const motion of value.motions) {
    const skeleton = skeletons.get(motion.skeleton);
    if (skeleton === undefined)
      diagnostics.push(
        engineDiagnostic(
          id,
          `motion:${motion.id}`,
          `references missing skeleton "${motion.skeleton}"`,
        ),
      );
    else
      appendValidation(diagnostics, id, validateMotion({ motion, skeleton }));
  }
  return diagnostics;
};

/** Validate bounded source-authored formation cues against one compiled shot. */
export const validateAutoMovieFormationMotions = (
  contract: IAutoMovieShotContract,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (field: string, expectation: string): void => {
    diagnostics.push(engineDiagnostic(contract.id, field, expectation));
  };
  if (value.formationMotions.length > 256)
    fail(
      "formationMotions",
      "must contain at most 256 compact cues rather than per-member curves",
    );
  const ids = new Set<string>();
  const participating = new Set(
    contract.participants.flatMap((participant) =>
      participant.kind === "formation" ? [participant.id] : [],
    ),
  );
  const priorByFormation = new Map<
    string,
    IAutoMovieCompiledShotSource["formationMotions"][number]
  >();
  for (const cue of [...value.formationMotions].sort(
    (left, right) =>
      compareCodeUnits(left.formation, right.formation) ||
      left.start - right.start ||
      compareCodeUnits(left.id, right.id),
  )) {
    if (cue.id.trim().length === 0 || ids.has(cue.id))
      fail(
        `formationMotion:${cue.id || "(blank)"}`,
        "must have one non-blank id unique inside the shot",
      );
    ids.add(cue.id);
    if (
      participating.has(cue.formation) === false ||
      value.formations.some((formation) => formation.id === cue.formation) ===
        false
    )
      fail(
        `formationMotion:${cue.id}.formation`,
        `must reference participating compiled formation "${cue.formation}"`,
      );
    if (
      Number.isFinite(cue.start) === false ||
      Number.isFinite(cue.end) === false ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.end > contract.durationSeconds
    )
      fail(
        `formationMotion:${cue.id}.time`,
        `must be one positive interval inside 0..${contract.durationSeconds}s`,
      );
    for (const [name, state] of [
      ["from", cue.from],
      ["to", cue.to],
    ] as const) {
      if (
        [state.translation.x, state.translation.y, state.translation.z].some(
          (number) =>
            Number.isFinite(number) === false ||
            Math.abs(number) > 1_000_000_000,
        ) ||
        Number.isFinite(state.facingOffsetDeg) === false ||
        Math.abs(state.facingOffsetDeg) > 360_000
      )
        fail(
          `formationMotion:${cue.id}.${name}`,
          "must keep translation inside +/-1000000000m and facing inside +/-360000 degrees",
        );
      if (
        [state.spacingScale.lateral, state.spacingScale.depth].some(
          (number) =>
            Number.isFinite(number) === false || number < 0.25 || number > 4,
        )
      )
        fail(
          `formationMotion:${cue.id}.${name}.spacingScale`,
          "must stay inside the bounded 0.25..4 envelope",
        );
    }
    const prior = priorByFormation.get(cue.formation);
    if (prior !== undefined && cue.start < prior.end)
      fail(
        `formationMotion:${cue.id}.start`,
        `must not overlap prior cue "${prior.id}" ending at ${prior.end}s`,
      );
    priorByFormation.set(cue.formation, cue);
  }
  return diagnostics;
};

/** Validate shot-local effect cues against compiler-owned streams and events. */
export const validateAutoMovieEffects = (
  contract: IAutoMovieShotContract,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const fail = (field: string, expectation: string): void => {
    diagnostics.push(engineDiagnostic(contract.id, field, expectation));
  };
  const cues = value.effectCues ?? [];
  if (cues.length > 128)
    fail("effectCues", "must contain at most 128 bounded zone activations");
  const ids = new Set<string>();
  const priorByZone = new Map<string, (typeof cues)[number]>();
  const events = new Map(contract.events.map((event) => [event.id, event]));
  const samples = new Map(
    value.eventSamples.map((sample) => [sample.id, sample.time]),
  );
  for (const cue of [...cues].sort(
    (left, right) =>
      compareCodeUnits(left.zone, right.zone) ||
      left.start - right.start ||
      compareCodeUnits(left.id, right.id),
  )) {
    const field = `effectCue:${cue.id || "(blank)"}`;
    if (cue.id.trim().length === 0 || ids.has(cue.id))
      fail(field, "must have one non-blank id unique inside the shot");
    ids.add(cue.id);
    const compiled = value.effects.find((effect) => effect.id === cue.id);
    if (compiled === undefined || compiled.zone !== cue.zone)
      fail(
        `${field}.zone`,
        `must reference one current compiler-materialized world zone "${cue.zone}"`,
      );
    if (
      Number.isFinite(cue.start) === false ||
      Number.isFinite(cue.end) === false ||
      cue.start < 0 ||
      cue.end <= cue.start ||
      cue.end > contract.durationSeconds
    )
      fail(
        `${field}.time`,
        `must be one positive interval inside 0..${contract.durationSeconds}s`,
      );
    if (
      [cue.intensity.from, cue.intensity.to].some(
        (intensity) =>
          Number.isFinite(intensity) === false ||
          intensity < 0 ||
          intensity > 1,
      )
    )
      fail(`${field}.intensity`, "must stay inside the bounded 0..1 envelope");
    if (cue.event !== undefined) {
      const event = events.get(cue.event);
      const sample = samples.get(cue.event);
      if (
        event === undefined ||
        sample === undefined ||
        sample < cue.start ||
        sample >= cue.end
      )
        fail(
          `${field}.event`,
          `must name one compiled event realized inside [${cue.start}, ${cue.end})`,
        );
    }
    const prior = priorByZone.get(cue.zone);
    if (prior !== undefined && cue.start < prior.end)
      fail(
        `${field}.start`,
        `must not overlap prior zone cue "${prior.id}" ending at ${prior.end}s`,
      );
    priorByZone.set(cue.zone, cue);
  }
  if (
    value.effects.length !== cues.length ||
    value.effects.some((effect) => ids.has(effect.id) === false)
  )
    fail(
      "effects",
      "must contain exactly one compiler-owned stream for every source cue",
    );
  return diagnostics;
};

const appendValidation = (
  diagnostics: IAutoMovieDiagnostic[],
  id: string,
  validation: ReturnType<typeof validateModel>,
): void => {
  if (validation.success === false)
    for (const violation of validation.violations)
      diagnostics.push({
        code: "engine-validation-failed",
        category: "error",
        phase: "compile",
        target: `shot:${id}`,
        path: null,
        message: `${violation.path}: ${violation.expected}. Correct the owning shot source before compileProject.`,
      });
};

const engineDiagnostic = (
  id: string,
  field: string,
  expectation: string,
): IAutoMovieDiagnostic => ({
  code: "engine-validation-failed",
  category: "error",
  phase: "compile",
  target: `shot:${id}`,
  path: null,
  message: `${field} ${expectation}. Correct the owning shot source before compileProject.`,
});

const missingDesignDiagnostics = (
  project: AutoMovieProductionProject,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): IAutoMovieDiagnostic[] => {
  const productionSegment = encodeAutoMoviePathSegment(project.productionId);
  const diagnostics: IAutoMovieDiagnostic[] = [];
  if (graph.production === null)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "production",
      path: `.automovie/design/${productionSegment}/production.json`,
      message: "Production design is missing. Call setProductionDesign.",
    });
  if (graph.world === null)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "world",
      path: ".automovie/design/shared/world.json",
      message: "World design is missing. Call setWorldDesign.",
    });
  if (graph.shots.size === 0)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "shots",
      path: `.automovie/design/${productionSegment}/shots`,
      message:
        "No shot contract exists. Call setShotContract for the first shot.",
    });
  return diagnostics;
};

const sourcePathDiagnostic = (
  id: string,
  sourcePath: string,
  error: unknown,
): IAutoMovieDiagnostic => {
  const message = errorMessage(error);
  return {
    code:
      error instanceof AutoMovieProductionSourcePathError &&
      error.reason === "outside-root"
        ? "source-path-outside-root"
        : "source-path-missing",
    category: "error",
    phase: "source",
    target: `shot:${id}`,
    path: sourcePath,
    message,
  };
};

const filmSourcePathDiagnostic = (error: unknown): IAutoMovieDiagnostic => ({
  code:
    error instanceof AutoMovieProductionSourcePathError &&
    error.reason === "outside-root"
      ? "source-path-outside-root"
      : "source-path-missing",
  category: "error",
  phase: "source",
  target: "film",
  path: FILM_SOURCE_PATH,
  message: `${errorMessage(error)} Export "${FILM_SOURCE_EXPORT}" with build(context) from ${FILM_SOURCE_PATH}.`,
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isTypeScriptSourcePath = (file: string): boolean =>
  [".ts", ".tsx", ".mts", ".cts"].includes(path.extname(file).toLowerCase());

const compilerAssetInventory = (
  manifestPath: IAutoMovieProductionManifest["assetManifest"],
  inputs: readonly IAutoMovieProductionContentInput[],
  productionId: string,
  graph: IAutoMovieProductionDesignGraph,
): {
  assets: string[];
  records: IAutoMovieAssetProvenance[];
  diagnostics: IAutoMovieDiagnostic[];
} => {
  if (manifestPath === undefined)
    return { assets: [], records: [], diagnostics: [] };
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const diagnostic = (code: string, target: string, message: string): void => {
    diagnostics.push({
      code,
      category: "error",
      phase: "project",
      target,
      path: manifestPath,
      message,
    });
  };
  const manifestInput = inputs.find((entry) => entry.path === manifestPath);
  if (manifestInput?.bytes === null || manifestInput === undefined) {
    diagnostic(
      "asset-manifest-missing",
      "asset-manifest",
      `Production manifest declares "${manifestPath}", but that physical provenance ledger is absent. Restore it before compiling asset references.`,
    );
    return { assets: [], records: [], diagnostics };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(manifestInput.bytes).toString("utf8"));
  } catch (error) {
    diagnostic(
      "asset-manifest-invalid",
      "asset-manifest",
      `Asset manifest is not valid JSON: ${errorMessage(error)}. Restore one IAutoMovieAssetManifest before compiling.`,
    );
    return { assets: [], records: [], diagnostics };
  }
  const validation = typia.validateEquals<IAutoMovieAssetManifest>(decoded);
  if (validation.success === false) {
    diagnostic(
      "asset-manifest-invalid",
      "asset-manifest",
      `Asset manifest does not satisfy IAutoMovieAssetManifest: ${validation.errors
        .map((error) => `${error.path}: ${error.expected}`)
        .join("; ")}. Correct the typed provenance ledger before compiling.`,
    );
    return { assets: [], records: [], diagnostics };
  }

  const content = new Map(inputs.map((entry) => [entry.path, entry]));
  const paths = new Map<string, string>();
  const assets = validation.data.assets
    .filter((asset) =>
      asset.uses.some((use) => use.production === productionId),
    )
    .map((asset) => asset.path);
  const orderedPaths = validation.data.assets.map((asset) => asset.path);
  if (
    orderedPaths.some(
      (asset, index) =>
        index !== 0 && compareCodeUnits(orderedPaths[index - 1]!, asset) >= 0,
    )
  )
    diagnostic(
      "asset-manifest-order",
      "asset-manifest",
      "Asset entries must be in unique canonical path order. Sort them by code unit and remove duplicates before compiling.",
    );
  const activeConsumerAssets = new Map<string, string>();
  for (const asset of validation.data.assets) {
    const folded = asset.path.toLowerCase();
    const prior = paths.get(folded);
    if (
      isCanonicalAssetPath(asset.path) === false ||
      (prior !== undefined && prior !== asset.path)
    )
      diagnostic(
        "asset-path-invalid",
        asset.path,
        `Asset path "${asset.path}" is not one canonical, portable project-relative identity. Keep one spelling inside declared content roots.`,
      );
    paths.set(folded, asset.path);
    const input = content.get(asset.path);
    if (input?.bytes === null || input === undefined || input.render === false)
      diagnostic(
        "asset-bytes-missing",
        asset.path,
        `Manifest asset "${asset.path}" is not a physical file inside contentRoots/contentFiles. Restore and declare the exact bytes before compiling.`,
      );
    else if (asset.digest !== digestAutoMovieBytes(input.bytes))
      diagnostic(
        "asset-digest-mismatch",
        asset.path,
        `Manifest digest ${asset.digest} does not match current bytes ${digestAutoMovieBytes(input.bytes)}. Restore the licensed bytes or update provenance from the verified source.`,
      );
    if (
      isSha256Digest(asset.digest) === false ||
      isSha256Digest(asset.original.digest) === false ||
      isHttpUrl(asset.original.url) === false ||
      asset.license.identifier.trim().length === 0 ||
      isHttpUrl(asset.license.url) === false ||
      asset.uses.length === 0 ||
      asset.uses.some(assetUseIncomplete) ||
      asset.processing.some(assetProcessingStepIncomplete)
    )
      diagnostic(
        "asset-provenance-incomplete",
        asset.path,
        `Asset "${asset.path}" lacks a full source URL, original/current SHA-256, license, processing identity, or reasoned use. Complete the distribution ledger before compiling.`,
      );
    if (asset.processing.length === 0 && asset.digest !== asset.original.digest)
      diagnostic(
        "asset-processing-missing",
        asset.path,
        `Asset "${asset.path}" differs from its original digest but records no processing steps. Record the reproducible transformation chain before compiling.`,
      );
    if (
      isExternalModelAsset(asset.path) &&
      (asset.model === undefined ||
        asset.model.ingestProfile.trim().length === 0 ||
        asset.model.lod.length === 0)
    )
      diagnostic(
        "asset-model-provenance-missing",
        asset.path,
        `External model "${asset.path}" must declare its ingest profile, explicit LOD ledger, collision proxy and measurement proxy before compiling.`,
      );
  }
  for (const asset of validation.data.assets) {
    const activeUses = asset.uses.filter(
      (use) => use.production === productionId,
    );
    const seenUses = new Set<string>();
    for (const use of activeUses) {
      const key = `${use.consumer.kind}\0${use.consumer.id}`;
      const priorAsset = activeConsumerAssets.get(key);
      if (seenUses.has(key) || priorAsset !== undefined)
        diagnostic(
          "asset-use-duplicate",
          asset.path,
          `Asset "${asset.path}" repeats active consumer ${use.consumer.kind} "${use.consumer.id}"${priorAsset === undefined ? "" : ` already owned by "${priorAsset}"`}. Keep one reasoned use per production consumer.`,
        );
      seenUses.add(key);
      activeConsumerAssets.set(key, asset.path);
      if (assetConsumerExists(graph, asset.path, use.consumer) === false)
        diagnostic(
          "asset-use-dangling",
          asset.path,
          `Asset "${asset.path}" cites missing ${use.consumer.kind} "${use.consumer.id}" in production "${productionId}". Correct the typed consumer or remove the stale use.`,
        );
    }
    if (asset.model === undefined) continue;
    let priorLevel = -1;
    const levels = new Set<string>();
    for (const lod of asset.model.lod) {
      const order = ["hero", "near", "far"].indexOf(lod.level);
      const target = paths.get(lod.asset.toLowerCase());
      if (
        levels.has(lod.level) ||
        order <= priorLevel ||
        target === undefined ||
        isExternalModelAsset(target) === false
      )
        diagnostic(
          "asset-model-lod-dangling",
          asset.path,
          `Model asset "${asset.path}" has duplicate/out-of-order LOD "${lod.level}" or points to non-model manifest asset "${lod.asset}". Keep unique hero/near/far levels in order and ground each in model bytes.`,
        );
      levels.add(lod.level);
      priorLevel = Math.max(priorLevel, order);
    }
    for (const [name, proxy] of [
      ["collision", asset.model.collisionProxy],
      ["measurement", asset.model.measurementProxy],
    ] as const)
      if (
        proxy.kind === "asset"
          ? paths.has(proxy.asset.toLowerCase()) === false
          : Object.values(proxy.parameters).some(
              (value) => Number.isFinite(value) === false,
            )
      )
        diagnostic(
          "asset-model-proxy-dangling",
          asset.path,
          `Model asset "${asset.path}" has a ${name} proxy that is not grounded in manifest bytes or finite generated-recipe parameters. Record an existing asset or a closed generated recipe.`,
        );
  }
  for (const [id, model] of graph.models) {
    if (model.asset === undefined) continue;
    const record = validation.data.assets.find(
      (asset) => asset.path === model.asset,
    );
    if (
      isExternalModelAsset(model.asset) === false ||
      record === undefined ||
      record.model === undefined ||
      record.uses.some(
        (use) =>
          use.production === productionId &&
          use.consumer.kind === "model-recipe" &&
          use.consumer.id === id,
      ) === false
    )
      diagnostic(
        "asset-use-missing",
        model.asset,
        `Model recipe "${id}" consumes "${model.asset}" without external-model provenance and one matching typed use for production "${productionId}". Register the exact model bytes, model decisions and model-recipe use.`,
      );
  }
  return { assets, records: validation.data.assets, diagnostics };
};

const assetUseIncomplete = (
  use: IAutoMovieAssetProvenance["uses"][number],
): boolean =>
  use.production.trim().length === 0 ||
  use.consumer.id.trim().length === 0 ||
  use.reason.trim().length === 0;

const assetProcessingStepIncomplete = (
  step: IAutoMovieAssetProvenance["processing"][number],
): boolean => step.tool.trim().length === 0 || step.command.trim().length === 0;

const assetConsumerExists = (
  graph: IAutoMovieProductionDesignGraph,
  assetPath: string,
  consumer: IAutoMovieAssetProvenance["uses"][number]["consumer"],
): boolean => {
  switch (consumer.kind) {
    case "audio-cue":
      return true;
    case "model-recipe":
      return graph.models.get(consumer.id)?.asset === assetPath;
  }
};

const validateCompiledAssetUses = (
  productionId: string,
  records: readonly IAutoMovieAssetProvenance[],
  edit: IAutoMovieFilmEdit,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const audioByConsumer = new Map<string, string>();
  for (const asset of records)
    for (const use of asset.uses)
      if (use.production === productionId && use.consumer.kind === "audio-cue")
        audioByConsumer.set(use.consumer.id, asset.path);
  const actual = new Map(edit.tracks.audio.map((cue) => [cue.id, cue.asset]));
  for (const [id, asset] of audioByConsumer)
    if (actual.get(id) !== asset)
      diagnostics.push(
        filmDiagnostic(
          "asset-use-stale",
          `Asset ledger assigns "${asset}" to audio cue "${id}", but the active film does not contain that exact reference. Correct the production use or film cue.`,
        ),
      );
  for (const [id, asset] of actual)
    if (audioByConsumer.get(id) !== asset)
      diagnostics.push(
        filmDiagnostic(
          "asset-use-missing",
          `Audio cue "${id}" consumes "${asset}" without one matching typed use for production "${productionId}". Add the exact production/audio-cue ledger entry.`,
        ),
      );
  return diagnostics;
};

const isCanonicalAssetPath = (value: string): boolean =>
  path.posix.isAbsolute(value) === false &&
  /^[A-Za-z]:/.test(value) === false &&
  value.includes("\\") === false &&
  value !== "." &&
  path.posix.normalize(value) === value &&
  value.split("/").every((segment) => segment.length > 0 && segment !== "..");

const isSha256Digest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/.test(value);

const isHttpUrl = (value: string): boolean => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const isExternalModelAsset = (value: string): boolean =>
  [".gltf", ".glb", ".vrm"].includes(path.extname(value).toLowerCase());

const contentFingerprintFields = (
  inputs: readonly IAutoMovieProductionContentInput[],
): IAutoMovieFingerprintField[] =>
  inputs.map((content) => ({
    role: `content:${content.path}`,
    kind: content.bytes === null ? "absent" : "file",
    payload:
      content.bytes === null
        ? new Uint8Array()
        : content.source && isTypeScriptSourcePath(content.path)
          ? normalizeAutoMovieSource(content.bytes)
          : content.bytes,
  }));

const productionCompilerInputFingerprint = (
  productionId: string,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
  sourceFields: readonly IAutoMovieFingerprintField[],
  contentFields: readonly IAutoMovieFingerprintField[],
): AutoMovieContentDigest =>
  fingerprintAutoMovieFields([
    {
      role: "protocol",
      kind: "compile-input",
      payload: Buffer.from(
        `${AUTOMOVIE_COMPILE_FINGERPRINT_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_COMPILER_VERSION}`,
        "utf8",
      ),
    },
    {
      role: "production",
      kind: "namespace",
      payload: Buffer.from(productionId, "utf8"),
    },
    ...designFingerprintFields(graph),
    ...sourceFields,
    ...contentFields,
  ]);

/**
 * Re-derive the current compiler-input identity without compiling or writing.
 *
 * Guarded publications use this inside the commit lock to prove that the
 * design, source, and declared-content bytes still match the snapshot they
 * intend to publish.
 */
export const currentAutoMovieProductionCompilerInputFingerprint = (
  project: AutoMovieProductionProject,
  scope: IAutoMovieCompileProjectInput["scope"],
): AutoMovieContentDigest | null => {
  try {
    const graph = project.graph();
    const sourceFields: IAutoMovieFingerprintField[] = [];
    for (const [id, contract] of graph.shots) {
      if (scope === "design") {
        sourceFields.push({
          role: `source:${id}`,
          kind: "not-inspected",
          payload: new Uint8Array(),
        });
        continue;
      }
      try {
        sourceFields.push({
          role: `source:${id}`,
          kind: "typescript",
          payload: normalizeAutoMovieSource(
            project.readSource(contract.source.module),
          ),
        });
      } catch {
        sourceFields.push({
          role: `source:${id}`,
          kind: "absent",
          payload: new Uint8Array(),
        });
      }
    }
    if (scope === "design")
      sourceFields.push({
        role: "source:film",
        kind: "not-inspected",
        payload: new Uint8Array(),
      });
    else
      try {
        sourceFields.push({
          role: "source:film",
          kind: "typescript",
          payload: normalizeAutoMovieSource(
            project.readSource(FILM_SOURCE_PATH),
          ),
        });
      } catch {
        sourceFields.push({
          role: "source:film",
          kind: "absent",
          payload: new Uint8Array(),
        });
      }
    const contentFields: IAutoMovieFingerprintField[] = [];
    if (scope !== "design")
      try {
        contentFields.push(
          ...contentFingerprintFields(project.contentInputs()),
        );
      } catch {
        contentFields.push({
          role: "content:inventory",
          kind: "unsafe",
          payload: new Uint8Array(),
        });
      }
    return productionCompilerInputFingerprint(
      project.productionId,
      graph,
      sourceFields,
      contentFields,
    );
  } catch {
    return null;
  }
};

const designFingerprintFields = (
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): IAutoMovieFingerprintField[] => {
  const fields: IAutoMovieFingerprintField[] = [];
  const add = (role: string, value: unknown): void => {
    fields.push({
      role,
      kind: value === null ? "absent" : "canonical-json",
      payload:
        value === null ? new Uint8Array() : canonicalAutoMovieJsonBytes(value),
    });
  };
  add("design:production", graph.production);
  for (const [id, value] of graph.models) add(`design:model:${id}`, value);
  add("design:world", graph.world);
  for (const [id, value] of graph.formations)
    add(`design:formation:${id}`, value);
  for (const [id, value] of graph.shots) add(`design:shot:${id}`, value);
  for (const [id, value] of graph.acceptance)
    add(`design:acceptance:${id}`, value);
  return fields;
};

const materializeGeneratedFiles = (
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
  runtimeModels: ReadonlyMap<
    string,
    IAutoMovieCompiledShotSource["models"][number]
  >,
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
  realizations: ReadonlyMap<string, IAutoMovieCompiledContractRealization>,
  film: {
    edit: IAutoMovieCompiledFilmEdit;
    timeline: IAutoMovieFilmTimeline;
  } | null,
  inputFingerprint: AutoMovieContentDigest,
): ReadonlyMap<string, Uint8Array> => {
  const files = new Map<string, Uint8Array>();
  const put = (file: string, value: unknown): void => {
    files.set(
      file,
      Buffer.concat([
        Buffer.from(canonicalAutoMovieJsonBytes(value)),
        Buffer.from("\n", "utf8"),
      ]),
    );
  };
  put("contracts/production.json", graph.production);
  put("contracts/world.json", graph.world);
  for (const [id, value] of graph.models)
    put(`contracts/models/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of graph.formations)
    put(`contracts/formations/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of graph.shots)
    put(`contracts/shots/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of graph.acceptance)
    put(`contracts/acceptance/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of runtimeModels)
    put(`models/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of compiled)
    put(`shots/${encodeAutoMoviePathSegment(id)}.json`, value);
  for (const [id, value] of realizations)
    put(`realizations/${encodeAutoMoviePathSegment(id)}.json`, value);
  if (film !== null) {
    put("contracts/film-edit.json", film.edit);
    put("film-timeline.json", film.timeline);
  }
  put("manifests/compile.json", {
    version: 1,
    compiler: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
    inputFingerprint,
    models: [...runtimeModels.keys()],
    shots: [...compiled.keys()],
    film: film?.timeline.id ?? null,
  });
  return files;
};

const materializeFilmArtifacts = (
  draft: ICompiledFilmDraft,
  sourceDigest: AutoMovieContentDigest,
  inputFingerprint: AutoMovieContentDigest,
): {
  edit: IAutoMovieCompiledFilmEdit;
  timeline: IAutoMovieFilmTimeline;
} => ({
  edit: {
    version: 1,
    compiler: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
    inputFingerprint,
    source: {
      path: FILM_SOURCE_PATH,
      export: FILM_SOURCE_EXPORT,
      digest: sourceDigest,
    },
    edit: draft.edit,
  },
  timeline: {
    ...draft.timeline,
    compiler: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
    inputFingerprint,
    sourceDigest,
  },
});

const statusesOf = (
  project: AutoMovieProductionProject,
  files: readonly IAutoMovieGeneratedFile[],
): IAutoMovieMaterializedFile[] => {
  return files.map((file) => {
    let before: AutoMovieContentDigest | null = null;
    try {
      before = digestAutoMovieBytes(project.readGeneratedFile(file.path));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("does not exist") === false
      )
        throw error;
    }
    return {
      ...file,
      status:
        before === null
          ? "created"
          : before === file.digest
            ? "unchanged"
            : "updated",
    };
  });
};

const sourceTargetsOf = (
  file: string,
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): string[] => {
  if (file === "contracts/film-edit.json" || file === "film-timeline.json")
    return ["film"];
  for (const [id] of graph.shots)
    if (
      file === `shots/${encodeAutoMoviePathSegment(id)}.json` ||
      file === `realizations/${encodeAutoMoviePathSegment(id)}.json` ||
      file === `contracts/shots/${encodeAutoMoviePathSegment(id)}.json`
    )
      return [`shot:${id}`];
  for (const [id] of graph.models)
    if (
      file === `models/${encodeAutoMoviePathSegment(id)}.json` ||
      file === `contracts/models/${encodeAutoMoviePathSegment(id)}.json`
    )
      return [`model:${id}`];
  for (const [id] of graph.formations)
    if (file === `contracts/formations/${encodeAutoMoviePathSegment(id)}.json`)
      return [`formation:${id}`];
  for (const [id] of graph.acceptance)
    if (file === `contracts/acceptance/${encodeAutoMoviePathSegment(id)}.json`)
      return [`acceptance:${id}`];
  return [
    file === "contracts/production.json"
      ? "production"
      : file === "contracts/world.json"
        ? "world"
        : "compiler",
  ];
};

const reviewGateDiagnostics = (
  queue: IAutoMovieReviewQueue,
): IAutoMovieDiagnostic[] =>
  queue.entries.flatMap((entry): IAutoMovieDiagnostic[] =>
    entry.state === "complete"
      ? []
      : [
          {
            code:
              entry.state === "missing"
                ? "review-missing"
                : entry.state === "stale"
                  ? "review-stale"
                  : entry.state === "revise"
                    ? "review-revise"
                    : "review-incomplete",
            category: "error",
            phase: "review",
            target: reviewTargetKey(entry.target),
            path: null,
            message: `Review state is ${entry.state}. Run prepareReview, correct the target, and submitReview before this compile scope.`,
          },
        ],
  );

const finalDeliverableDiagnostics = (
  project: AutoMovieProductionProject,
  production: ReturnType<AutoMovieProductionProject["graph"]>["production"],
  inputFingerprint: AutoMovieContentDigest,
): IAutoMovieDiagnostic[] => {
  if (production === null) return [];
  let bytes: Uint8Array | null;
  try {
    bytes = project.readTrackedStateFile("render-manifest.json");
  } catch {
    bytes = Buffer.from("unsafe tracked render manifest");
  }
  if (bytes === null)
    return [
      {
        code: "render-deliverable-missing",
        category: "error",
        phase: "render",
        target: production.id,
        path: `.automovie/productions/${encodeAutoMoviePathSegment(project.productionId)}/render-manifest.json`,
        message:
          "Required deliverables have no current render manifest. Run the project render command before compileProject scope final.",
      },
    ];
  const manifestDigest = digestAutoMovieBytes(bytes);
  let receipt: IAutoMovieProductionRenderReceipt | null = null;
  try {
    const receiptBytes = project.readTrackedStateFile(
      "render-manifest-receipt.json",
    );
    if (receiptBytes !== null) {
      const validation =
        typia.validateEquals<IAutoMovieProductionRenderReceipt>(
          JSON.parse(Buffer.from(receiptBytes).toString("utf8")) as unknown,
        );
      if (validation.success) receipt = validation.data;
    }
  } catch {
    receipt = null;
  }
  if (
    receipt === null ||
    receipt.version !== 2 ||
    receipt.manifestDigest !== manifestDigest
  )
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-unowned",
        production.id,
        "The aggregate render manifest lacks the matching renderer-owned receipt. Recreate it through the production render command instead of editing tracked state directly.",
      ),
    ];
  let manifest: IAutoMovieProductionRenderManifest;
  try {
    const validation = typia.validateEquals<IAutoMovieProductionRenderManifest>(
      JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown,
    );
    if (validation.success === false)
      return [
        renderDeliverableDiagnostic(
          "render-deliverable-invalid",
          production.id,
          `The active production render manifest does not satisfy the aggregate render-ledger schema: ${validation.errors
            .map((error) => `${error.path} expects ${error.expected}`)
            .join("; ")}. Recreate it through the production render command.`,
        ),
      ];
    manifest = validation.data;
  } catch {
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-invalid",
        production.id,
        "The aggregate render manifest is not valid JSON. Recreate it through the production render command.",
      ),
    ];
  }
  if (manifest.compileFingerprint !== inputFingerprint)
    return [
      renderDeliverableDiagnostic(
        "render-deliverable-stale",
        production.id,
        "Required deliverables are not bound to the current compile fingerprint. Re-render the current production and replace the aggregate render manifest.",
      ),
    ];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const declared = new Map(
    production.deliverables.map((deliverable) => [deliverable.id, deliverable]),
  );
  const resident = new Map<
    string,
    IAutoMovieProductionRenderManifest["deliverables"][number]
  >();
  const filePaths = new Set<string>();
  const receiptByPath = new Map(
    receipt.files.map((file) => [
      normalizeSlash(file.path).toLowerCase(),
      file,
    ]),
  );
  if (receiptByPath.size !== receipt.files.length)
    diagnostics.push(
      renderDeliverableDiagnostic(
        "render-deliverable-unowned",
        production.id,
        "The renderer-owned receipt repeats a physical file path. Recreate it through the production render command.",
      ),
    );
  const witnessedReceiptPaths = new Set<string>();
  for (const deliverable of manifest.deliverables) {
    if (resident.has(deliverable.id))
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-invalid",
          deliverable.id,
          `Deliverable "${deliverable.id}" is duplicated in the aggregate render manifest. Keep one byte-exact record.`,
        ),
      );
    else resident.set(deliverable.id, deliverable);
    const contract = declared.get(deliverable.id);
    if (contract === undefined || contract.kind !== deliverable.kind)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-invalid",
          deliverable.id,
          `Deliverable "${deliverable.id}" kind "${deliverable.kind}" does not match current production design. Remove it or restore the exact declared id and kind.`,
        ),
      );
    if (deliverable.files.length === 0)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-incomplete",
          deliverable.id,
          `Deliverable "${deliverable.id}" has no output file. Render at least one owned byte artifact and record its digest and size.`,
        ),
      );
    const probes: IAutoMovieProductionMediaProbe[] = [];
    for (const file of deliverable.files) {
      const portablePath = normalizeSlash(file.path).toLowerCase();
      if (filePaths.has(portablePath))
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-invalid",
            deliverable.id,
            `Render file "${file.path}" is claimed more than once. Give each owned output one deliverable owner.`,
            file.path,
          ),
        );
      filePaths.add(portablePath);
      witnessedReceiptPaths.add(portablePath);
      if (
        Number.isInteger(file.bytes) === false ||
        file.bytes <= 0 ||
        file.mediaType.trim().length === 0
      ) {
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-invalid",
            deliverable.id,
            `Render file "${file.path}" needs a positive integer byte size and non-empty media type. Rebuild its ledger entry.`,
            file.path,
          ),
        );
        continue;
      }
      try {
        const actual = project.readRenderFile(file.path);
        if (
          actual.length !== file.bytes ||
          digestAutoMovieBytes(actual) !== file.digest
        )
          diagnostics.push(
            renderDeliverableDiagnostic(
              "render-deliverable-stale",
              deliverable.id,
              `Render file "${file.path}" bytes do not match its recorded size and digest. Re-render the current deliverable.`,
              file.path,
            ),
          );
        const receiptFile = receiptByPath.get(portablePath);
        if (
          receiptFile === undefined ||
          receiptFile.deliverable !== deliverable.id ||
          receiptFile.digest !== file.digest ||
          receiptFile.bytes !== file.bytes ||
          receiptFile.mediaType !== file.mediaType
        )
          diagnostics.push(
            renderDeliverableDiagnostic(
              "render-deliverable-unowned",
              deliverable.id,
              `Render file "${file.path}" lacks one exact renderer-owned byte and media-probe receipt. Recreate the aggregate manifest through the production render command.`,
              file.path,
            ),
          );
        else {
          let probe: IAutoMovieProductionMediaProbe;
          try {
            probe = probeProductionMedia({
              kind: deliverable.kind,
              mediaType: file.mediaType,
              bytes: actual,
            });
          } catch (error) {
            diagnostics.push(
              renderDeliverableDiagnostic(
                "render-deliverable-invalid",
                deliverable.id,
                `Render file "${file.path}" failed current media probing: ${errorMessage(error)} Re-render a valid declared medium.`,
                file.path,
              ),
            );
            continue;
          }
          if (canonicalizeProbe(probe) !== canonicalizeProbe(receiptFile.probe))
            diagnostics.push(
              renderDeliverableDiagnostic(
                "render-deliverable-unowned",
                deliverable.id,
                `Render file "${file.path}" current media facts differ from its renderer-owned receipt. Recreate the aggregate manifest.`,
                file.path,
              ),
            );
          else probes.push(probe);
        }
      } catch (error) {
        diagnostics.push(
          renderDeliverableDiagnostic(
            "render-deliverable-missing",
            deliverable.id,
            `${errorMessage(error)} Re-render the missing owned output.`,
            file.path,
          ),
        );
      }
    }
    appendDeliverableTimelineDiagnostics(
      diagnostics,
      production,
      deliverable,
      probes,
    );
  }
  for (const file of receipt.files)
    if (
      witnessedReceiptPaths.has(normalizeSlash(file.path).toLowerCase()) ===
      false
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-unowned",
          file.deliverable,
          `Renderer receipt file "${file.path}" is not owned by the current aggregate manifest. Recreate the manifest and receipt together.`,
          file.path,
        ),
      );
  for (const deliverable of production.deliverables)
    if (deliverable.required && resident.has(deliverable.id) === false)
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-missing",
          deliverable.id,
          `Required ${deliverable.kind} deliverable "${deliverable.id}" is absent from the aggregate render manifest. Render and record it before final compilation.`,
        ),
      );
  return diagnostics;
};

const appendDeliverableTimelineDiagnostics = (
  diagnostics: IAutoMovieDiagnostic[],
  production: NonNullable<
    ReturnType<AutoMovieProductionProject["graph"]>["production"]
  >,
  deliverable: IAutoMovieProductionRenderManifest["deliverables"][number],
  probes: readonly IAutoMovieProductionMediaProbe[],
): void => {
  const timed = ["feature", "guide-pass", "captions", "audio-mix"].includes(
    deliverable.kind,
  );
  const framed =
    deliverable.kind === "feature" || deliverable.kind === "guide-pass";
  const encoded =
    deliverable.kind === "feature" ||
    deliverable.kind === "guide-pass" ||
    deliverable.kind === "audio-mix";
  const expectedFrames = Math.round(
    production.targetRuntimeSeconds * production.frameFormat.fps,
  );
  if (
    (timed && deliverable.runtimeSeconds !== production.targetRuntimeSeconds) ||
    (!timed &&
      deliverable.runtimeSeconds !== null &&
      (Number.isFinite(deliverable.runtimeSeconds) === false ||
        deliverable.runtimeSeconds <= 0)) ||
    (framed && deliverable.frameCount !== expectedFrames) ||
    (!framed &&
      deliverable.frameCount !== null &&
      (Number.isInteger(deliverable.frameCount) === false ||
        deliverable.frameCount <= 0)) ||
    (encoded &&
      (deliverable.codec === null || deliverable.codec.trim().length === 0)) ||
    (!encoded &&
      deliverable.codec !== null &&
      deliverable.codec.trim().length === 0)
  )
    diagnostics.push(
      renderDeliverableDiagnostic(
        "render-deliverable-incomplete",
        deliverable.id,
        `Deliverable "${deliverable.id}" has incomplete runtime, frame-count, or codec evidence for kind "${deliverable.kind}". Match the ${production.targetRuntimeSeconds}s production clock and ${expectedFrames} frames where applicable.`,
      ),
    );
  if (deliverable.kind === "feature" || deliverable.kind === "guide-pass") {
    const video = probes.length === 1 ? probes[0] : null;
    if (
      video?.kind !== "video" ||
      video.width !== production.frameFormat.width ||
      video.height !== production.frameFormat.height ||
      video.frameCount !== expectedFrames ||
      frameClockClose(video.fps, production.frameFormat.fps) === false ||
      frameClockClose(video.runtimeSeconds, production.targetRuntimeSeconds) ===
        false ||
      deliverable.codec?.toLowerCase() !== video.codec ||
      deliverable.frameCount !== video.frameCount ||
      deliverable.runtimeSeconds !== video.runtimeSeconds
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-media-mismatch",
          deliverable.id,
          `Deliverable "${deliverable.id}" must be one parsed ${production.frameFormat.width}x${production.frameFormat.height} H.264 MP4 at ${production.frameFormat.fps}fps with ${expectedFrames} resident samples and ${production.targetRuntimeSeconds}s runtime. Manifest strings cannot substitute for parser-derived media facts.`,
        ),
      );
  } else if (deliverable.kind === "preview") {
    if (
      probes.length !== deliverable.files.length ||
      probes.some(
        (probe) =>
          probe.kind !== "png" ||
          probe.width !== production.frameFormat.width ||
          probe.height !== production.frameFormat.height,
      )
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-media-mismatch",
          deliverable.id,
          `Preview deliverable "${deliverable.id}" must contain decoded PNGs at the exact ${production.frameFormat.width}x${production.frameFormat.height} production raster.`,
        ),
      );
  } else if (deliverable.kind === "captions") {
    if (
      probes.length !== deliverable.files.length ||
      probes.some(
        (probe) =>
          probe.kind !== "webvtt" ||
          probe.lastCueSeconds > production.targetRuntimeSeconds,
      )
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-media-mismatch",
          deliverable.id,
          `Caption deliverable "${deliverable.id}" must contain parser-verified, ordered, non-empty WebVTT cues wholly inside the ${production.targetRuntimeSeconds}s production timeline.`,
        ),
      );
  } else {
    const audio = probes.length === 1 ? probes[0] : null;
    if (
      audio?.kind !== "audio" ||
      frameClockClose(audio.runtimeSeconds, production.targetRuntimeSeconds) ===
        false ||
      deliverable.codec !== audio.codec ||
      deliverable.runtimeSeconds !== audio.runtimeSeconds
    )
      diagnostics.push(
        renderDeliverableDiagnostic(
          "render-deliverable-media-mismatch",
          deliverable.id,
          `Audio deliverable "${deliverable.id}" must be one parsed audio/mp4 track with current production runtime and matching codec metadata.`,
        ),
      );
  }
};

const canonicalizeProbe = (probe: IAutoMovieProductionMediaProbe): string =>
  Buffer.from(canonicalAutoMovieJsonBytes(probe)).toString("utf8");

const frameClockClose = (left: number, right: number): boolean =>
  Math.abs(left - right) <=
  Number.EPSILON * 64 * Math.max(1, Math.abs(left), Math.abs(right));

const renderDeliverableDiagnostic = (
  code: string,
  target: string,
  message: string,
  renderPath: string | null = null,
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase: "render",
  target,
  path: renderPath,
  message,
});

const listFiles = (root: string): string[] => {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const child = path.join(directory, entry.name);
      const status = fs.lstatSync(child);
      if (status.isSymbolicLink()) files.push(child);
      else if (status.isDirectory()) visit(child);
      else if (status.isFile()) files.push(child);
    }
  };
  visit(root);
  return files;
};

const reviewTargetKey = (
  target: IAutoMovieReviewQueue["entries"][number]["target"],
): string => {
  if (target.kind === "source") return `source:${target.path}`;
  if (target.kind === "shot" || target.kind === "film")
    return `${target.kind}:${target.id}`;
  return target.design.kind === "production" || target.design.kind === "world"
    ? `design:${target.design.kind}`
    : `design:${target.design.kind}:${target.design.id}`;
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
