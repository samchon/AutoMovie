import {
  validateModel,
  validateMotion,
  validateShotArtifact,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompileProjectInput,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledContractRealization,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieGeneratedFile,
  IAutoMovieGeneratedManifest,
  IAutoMovieMaterializedFile,
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
import typia from "typia";

import { validateSceneArtifact } from "../validators/artifacts";
import {
  AutoMovieProductionProject,
  AutoMovieProductionSourcePathError,
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
  materializeCompiledShot,
  materializeFormationInventory,
  materializeProductionModels,
} from "./materializeProduction";
import { probeProductionMedia } from "./probeProductionMedia";
import { realizeShotContract } from "./realizeShotContract";
import { validateAutoMovieProductionGraph } from "./validateProductionDesign";

/** Production compiler protocol embedded in generated manifests. */
export const AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL = "automovie.compiler.v2";

/** Compiler package version. */
export const AUTOMOVIE_PRODUCTION_COMPILER_VERSION = (
  require(path.join(__dirname, "..", "..", "package.json")) as {
    version: string;
  }
).version;

/** Current review queue provider shared with the review service. */
export type AutoMovieReviewQueueProvider = (
  compileStatus: IAutoMovieCompileProjectOutput,
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
    const diagnostics: IAutoMovieDiagnostic[] = [
      ...missingDesignDiagnostics(graph),
      ...validateAutoMovieProductionGraph(graph),
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
    let formationInventory: ReturnType<typeof materializeFormationInventory> =
      {};
    if (input.scope !== "design" && designReady)
      try {
        runtimeModels = new Map(materializeProductionModels(graph.models));
        formationInventory = materializeFormationInventory(graph.formations);
      } catch (error) {
        diagnostics.push({
          code: "model-materialization-failed",
          category: "error",
          phase: "compile",
          target: "model-recipes",
          path: null,
          message: `${errorMessage(error)} Correct model and formation design before source compilation.`,
        });
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
          world: graph.world ?? emptyWorld(),
          formations: Object.fromEntries(graph.formations),
          runtimeModels: Object.fromEntries(runtimeModels),
          formationSlots: formationInventory,
        },
      });
      diagnostics.push(...result.diagnostics);
      if (result.value !== null) {
        const materialized = materializeCompiledShot({
          contract,
          formations: graph.formations,
          formationSlots: formationInventory,
          runtimeModels,
          source: result.value,
        });
        const realized = realizeShotContract({
          contract,
          production: graph.production,
          world: graph.world,
          formations: graph.formations,
          formationSlots: formationInventory,
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
    const contentFields: IAutoMovieFingerprintField[] = [];
    if (input.scope !== "design")
      try {
        for (const content of this.project.contentInputs())
          contentFields.push({
            role: `content:${content.path}`,
            kind: content.bytes === null ? "absent" : "file",
            payload:
              content.bytes === null
                ? new Uint8Array()
                : content.source && isTypeScriptSourcePath(content.path)
                  ? normalizeAutoMovieSource(content.bytes)
                  : content.bytes,
          });
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
    const inputFingerprint = fingerprintAutoMovieFields([
      {
        role: "protocol",
        kind: "compile-input",
        payload: Buffer.from(
          `${AUTOMOVIE_COMPILE_FINGERPRINT_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL}\0${AUTOMOVIE_PRODUCTION_COMPILER_VERSION}`,
          "utf8",
        ),
      },
      ...designFingerprintFields(graph),
      ...sourceFields,
      ...contentFields,
    ]);
    const files =
      input.scope === "design"
        ? null
        : materializeGeneratedFiles(
            graph,
            runtimeModels,
            compiled,
            realizations,
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
    const reviews = this.reviewQueue(statusForReview());
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
    if (diagnostics.some((diagnostic) => diagnostic.category === "error"))
      return {
        success: false,
        revision: this.project.revision(),
        compiler: {
          version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
          inputFingerprint,
        },
        diagnostics,
        reviews,
        materialized: [],
      };
    if (input.scope === "design")
      return {
        success: true,
        revision: this.project.revision(),
        compiler: {
          version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
          inputFingerprint,
        },
        diagnostics,
        reviews,
        materialized: [],
      };

    /* c8 ignore start -- design scope returns above; every remaining scope
    derives both source files and their manifest together. */
    if (files === null || manifest === null)
      throw new Error("Source compilation did not derive generated output.");
    /* c8 ignore stop */
    const materialized = statusesOf(this.project, entries);
    if (materialize === false)
      return {
        success: true,
        revision: this.project.revision(),
        compiler: {
          version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
          inputFingerprint,
        },
        diagnostics,
        reviews,
        materialized: [],
      };
    const revision = this.project.commitGenerated(files, manifest);
    return {
      success: true,
      revision,
      compiler: {
        version: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
        inputFingerprint,
      },
      diagnostics,
      reviews: this.reviewQueue({
        ...statusForReview(),
        success: true,
        revision,
      }),
      materialized,
    };
  }

  private generatedOwnershipDiagnostics(
    expected: IAutoMovieGeneratedManifest,
    repairDeclaredFiles: boolean,
  ): IAutoMovieDiagnostic[] {
    const manifest = this.project.generatedManifest();
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
        path: ".automovie/generated-manifest.json",
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
        path: ".automovie/generated-manifest.json",
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
        path: ".automovie/generated-manifest.json",
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
    formationSlots: Readonly<Record<string, unknown>>;
  };
}

interface ICompileShotSourceResult {
  value: IAutoMovieShotSourceOutput | null;
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
): ICompileShotSourceResult => {
  const diagnostics = inspectSource(props.id, props.path, props.source);
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
  /* c8 ignore next -- reportDiagnostics:true always returns an array. */
  for (const diagnostic of transpiled.diagnostics ?? [])
    if (diagnostic.category === ts.DiagnosticCategory.Error)
      diagnostics.push({
        code: "source-transpile-failed",
        category: "error",
        phase: "source",
        target: `shot:${props.id}`,
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
      name: `automovie:${props.id}`,
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
            target: `shot:${props.id}`,
            path: props.path,
            message: `Export "${props.exportName}" with a build(context) function was not found. Add that named export to ${props.path}.`,
          },
        ],
      };
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
            target: `shot:${props.id}`,
            path: props.path,
            message: `Export "${props.exportName}" returned a Promise. Return a synchronous deterministic compiled shot from ${props.path}.`,
          },
        ],
      };
    const resultJson = sandbox.__automovieResultJson as unknown;
    const value =
      typeof resultJson === "string" ? JSON.parse(resultJson) : undefined;
    const validation = typia.validateEquals<IAutoMovieShotSourceOutput>(value);
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
              target: `shot:${props.id}`,
              path: props.path,
              message: `${error.path} expects ${error.expected}. Fix the returned compiled shot in ${props.path}.`,
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
          target: `shot:${props.id}`,
          path: props.path,
          message: `${message} Fix the deterministic build function in ${props.path}.`,
        },
      ],
    };
  }
};

const inspectSource = (
  id: string,
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
      target: `shot:${id}`,
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
  const bindings = clause.namedBindings;
  /* c8 ignore start -- TypeScript grammar requires a binding when an import
  clause has no default name. Reject a synthetic malformed AST conservatively. */
  if (bindings === undefined) return true;
  /* c8 ignore stop */
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

const appendValidation = (
  diagnostics: IAutoMovieDiagnostic[],
  id: string,
  validation: ReturnType<typeof validateModel>,
): void => {
  if (validation.success) {
    /* c8 ignore next 10 -- current engine validators emit warnings only in
       simulation passes that compiled-shot validation does not call. */
    for (const warning of validation.warnings ?? [])
      diagnostics.push({
        code: "engine-validation-warning",
        category: "warning",
        phase: "compile",
        target: `shot:${id}`,
        path: null,
        message: `${warning.path}: ${warning.expected}. Correct the source if the warning conflicts with the shot contract.`,
      });
  } else
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
  graph: ReturnType<AutoMovieProductionProject["graph"]>,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  if (graph.production === null)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "production",
      path: ".automovie/design/production.json",
      message: "Production design is missing. Call setProductionDesign.",
    });
  if (graph.world === null)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "world",
      path: ".automovie/design/world.json",
      message: "World design is missing. Call setWorldDesign.",
    });
  if (graph.shots.size === 0)
    diagnostics.push({
      code: "design-missing",
      category: "error",
      phase: "design",
      target: "shots",
      path: ".automovie/design/shots",
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

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isTypeScriptSourcePath = (file: string): boolean =>
  [".ts", ".tsx", ".mts", ".cts"].includes(path.extname(file).toLowerCase());

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
  put("manifests/compile.json", {
    version: 1,
    compiler: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
    inputFingerprint,
    models: [...runtimeModels.keys()],
    shots: [...compiled.keys()],
  });
  return files;
};

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
        path: ".automovie/render-manifest.json",
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
          `.automovie/render-manifest.json does not satisfy the aggregate render-ledger schema: ${validation.errors
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
  renderPath = ".automovie/render-manifest.json",
): IAutoMovieDiagnostic => ({
  code,
  category: "error",
  phase: "render",
  target,
  path: renderPath,
  message,
});

const emptyWorld = (): IAutoMovieWorldDesign => ({
  id: "missing-world",
  units: "meter",
  landmarks: [],
  surfaces: [],
  routes: [],
  effectZones: [],
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
