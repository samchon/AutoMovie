import {
  validateModel,
  validateMotion,
  validateShotArtifact,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieCompileProjectInput,
  IAutoMovieCompileProjectOutput,
  IAutoMovieCompiledShotSource,
  IAutoMovieDiagnostic,
  IAutoMovieGeneratedFile,
  IAutoMovieGeneratedManifest,
  IAutoMovieMaterializedFile,
  IAutoMovieReviewQueue,
  IAutoMovieShotContract,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript-compiler";
import typia from "typia";

import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import {
  AUTOMOVIE_COMPILE_FINGERPRINT_PROTOCOL,
  IAutoMovieFingerprintField,
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
  fingerprintAutoMovieFields,
  normalizeAutoMovieSource,
} from "./contentIdentity";
import { validateAutoMovieProductionGraph } from "./validateProductionDesign";

/** Production compiler protocol embedded in generated manifests. */
export const AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL = "automovie.compiler.v1";

/** Compiler package version. */
export const AUTOMOVIE_PRODUCTION_COMPILER_VERSION = (
  require(path.join(__dirname, "..", "..", "package.json")) as {
    version: string;
  }
).version;

/** Current review queue provider shared with the review service. */
export type AutoMovieReviewQueueProvider = () => IAutoMovieReviewQueue;

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
    const sourceFields: IAutoMovieFingerprintField[] = [];
    const compiled = new Map<string, IAutoMovieCompiledShotSource>();
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
        },
      });
      diagnostics.push(...result.diagnostics);
      if (result.value !== null) {
        diagnostics.push(
          ...validateCompiledShot(id, contract.durationSeconds, result.value),
        );
        compiled.set(id, result.value);
      }
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
    ]);
    if (input.scope !== "design")
      diagnostics.push(
        ...this.generatedOwnershipDiagnostics(inputFingerprint, materialize),
      );
    const reviews = this.reviewQueue();
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

    const files = materializeGeneratedFiles(graph, compiled, inputFingerprint);
    const previous = this.project.generatedManifest();
    const entries: IAutoMovieGeneratedFile[] = [...files]
      .map(([file, bytes]) => ({
        path: file,
        owner: "compiler" as const,
        digest: digestAutoMovieBytes(bytes),
        sourceTargets: sourceTargetsOf(file),
      }))
      .sort((left, right) => compareCodeUnits(left.path, right.path));
    const manifest: IAutoMovieGeneratedManifest = {
      version: 1,
      compiler: {
        packageVersion: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
        protocolVersion: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
      },
      inputFingerprint,
      files: entries,
    };
    const materialized = statusesOf(entries, previous);
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
      reviews: this.reviewQueue(),
      materialized,
    };
  }

  private generatedOwnershipDiagnostics(
    inputFingerprint: AutoMovieContentDigest,
    repairDeclaredFiles: boolean,
  ): IAutoMovieDiagnostic[] {
    const manifest = this.project.generatedManifest();
    if (manifest === null) return [];
    const diagnostics: IAutoMovieDiagnostic[] = [];
    const declared = new Set(
      manifest.files.map((file) => normalizeSlash(file.path)),
    );
    for (const file of listFiles(this.project.generatedRoot())) {
      const relative = normalizeSlash(
        path.relative(this.project.generatedRoot(), file),
      );
      if (declared.has(relative) === false)
        diagnostics.push({
          code: "generated-unowned",
          category: "error",
          phase: "compile",
          target: relative,
          path: normalizeSlash(path.relative(this.project.root, file)),
          message: `Generated file "${relative}" is absent from the ownership manifest. Remove it or regenerate through compileProject.`,
        });
    }
    for (const entry of manifest.files) {
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
            ? `Generated digest is ${String(actual)} but manifest expects ${entry.digest}. compileProject will regenerate this compiler-owned file.`
            : `Generated digest is ${String(actual)} but manifest expects ${entry.digest}. Run compileProject to regenerate it before accepting lint.`,
        });
    }
    if (manifest.inputFingerprint !== inputFingerprint)
      diagnostics.push({
        code: "generated-stale",
        category: "warning",
        phase: "compile",
        target: "generated-manifest",
        path: ".automovie/generated-manifest.json",
        message: `Generated input ${manifest.inputFingerprint} differs from current ${inputFingerprint}. Run compileProject to refresh generated output.`,
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
  };
}

interface ICompileShotSourceResult {
  value: IAutoMovieCompiledShotSource | null;
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
  for (const name of [
    "Date",
    "process",
    "require",
    "fetch",
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
    const validation =
      typia.validateEquals<IAutoMovieCompiledShotSource>(value);
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
    if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly !== true)
      report("source-import-unsupported", "runtime import");
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    )
      report("source-import-unsupported", "dynamic import");
    if (ts.isPropertyAccessExpression(node)) {
      const expression = node.expression.getText(sourceFile);
      const name = node.name.text;
      if (
        (expression === "Math" && name === "random") ||
        (expression === "Date" && name === "now") ||
        (expression === "performance" && name === "now") ||
        (expression === "crypto" && name === "randomUUID")
      )
        report("source-nondeterministic", `${expression}.${name}`);
    }
    if (
      ts.isIdentifier(node) &&
      [
        "Date",
        "process",
        "require",
        "fetch",
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

const validateCompiledShot = (
  id: string,
  duration: number,
  value: IAutoMovieCompiledShotSource,
): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  if (value.shot.id !== id)
    diagnostics.push(
      engineDiagnostic(id, "shot.id", `must equal contract id "${id}"`),
    );
  if (value.shot.duration !== duration)
    diagnostics.push(
      engineDiagnostic(
        id,
        "shot.duration",
        `must equal contract duration ${duration}`,
      ),
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
  const message = error instanceof Error ? error.message : String(error);
  return {
    code:
      message.includes("outside") || message.includes("escapes")
        ? "source-path-outside-root"
        : "source-path-missing",
    category: "error",
    phase: "source",
    target: `shot:${id}`,
    path: sourcePath,
    message,
  };
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
  compiled: ReadonlyMap<string, IAutoMovieCompiledShotSource>,
  inputFingerprint: AutoMovieContentDigest,
): ReadonlyMap<string, Uint8Array> => {
  const files = new Map<string, Uint8Array>();
  const put = (file: string, value: unknown): void => {
    files.set(file, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
  };
  put("contracts/production.json", graph.production);
  put("contracts/world.json", graph.world);
  for (const [id, value] of graph.models)
    put(`contracts/models/${encodeURIComponent(id)}.json`, value);
  for (const [id, value] of graph.formations)
    put(`contracts/formations/${encodeURIComponent(id)}.json`, value);
  for (const [id, value] of graph.shots)
    put(`contracts/shots/${encodeURIComponent(id)}.json`, value);
  for (const [id, value] of graph.acceptance)
    put(`contracts/acceptance/${encodeURIComponent(id)}.json`, value);
  for (const [id, value] of compiled)
    put(`shots/${encodeURIComponent(id)}.json`, value);
  put("manifests/compile.json", {
    version: 1,
    compiler: AUTOMOVIE_PRODUCTION_COMPILER_PROTOCOL,
    inputFingerprint,
    shots: [...compiled.keys()],
  });
  return files;
};

const statusesOf = (
  files: readonly IAutoMovieGeneratedFile[],
  previous: IAutoMovieGeneratedManifest | null,
): IAutoMovieMaterializedFile[] => {
  const before = new Map(
    (previous?.files ?? []).map((file) => [file.path, file.digest]),
  );
  return files.map((file) => ({
    ...file,
    status:
      before.has(file.path) === false
        ? "created"
        : before.get(file.path) === file.digest
          ? "unchanged"
          : "updated",
  }));
};

const sourceTargetsOf = (file: string): string[] => {
  const segments = file.split("/");
  if (segments[0] === "shots")
    return [`shot:${decodeURIComponent(segments[1]!.slice(0, -5))}`];
  if (segments[0] === "contracts" && segments.length >= 3) {
    const kind = new Map([
      ["models", "model"],
      ["formations", "formation"],
      ["shots", "shot"],
      ["acceptance", "acceptance"],
    ]).get(segments[1]!);
    return [`${kind!}:${decodeURIComponent(segments[2]!.slice(0, -5))}`];
  }
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
  if (
    production === null ||
    production.deliverables.some((item) => item.required) === false
  )
    return [];
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
  try {
    const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    if (
      typeof value === "object" &&
      value !== null &&
      "compileFingerprint" in value &&
      value.compileFingerprint === inputFingerprint
    )
      return [];
  } catch {
    // A malformed aggregate manifest is reported as stale below.
  }
  return [
    {
      code: "render-deliverable-stale",
      category: "error",
      phase: "render",
      target: production.id,
      path: ".automovie/render-manifest.json",
      message:
        "Required deliverables are not bound to the current compile fingerprint. Re-render the current production and replace the aggregate render manifest.",
    },
  ];
};

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
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() || entry.isSymbolicLink()) files.push(child);
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
