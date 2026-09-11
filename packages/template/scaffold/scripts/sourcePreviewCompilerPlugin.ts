import { randomUUID } from "node:crypto";
import path from "node:path";
import { Worker } from "node:worker_threads";
import type { ITtscCompilerResult } from "ttsc";
import type { Plugin } from "vite";

import { isViewerWatchOutput } from "./viewerWatchOptions";

const GENERATION_QUERY = "automovie-source-generation";
const OUTPUT_PREFIX = "node_modules/.cache/automovie/source-preview/";

/** Serve only the JavaScript emitted by one successful source compilation. */
export const sourcePreviewCompilerPlugin = (root: string): Plugin => {
  const session = randomUUID();
  let generation = 0;
  let state: {
    generation: string;
    phase: "compiling" | "ready" | "error";
    message: string;
  } = {
    generation: `${session}-${generation}`,
    phase: "compiling",
    message: "Compiling preview source with ttsc...",
  };
  let output = new Map<string, string>();
  const importedInputs = new Set<string>();
  const relativeSource = (file: string): string | undefined => {
    const relative = path.relative(root, file).split(path.sep).join("/");
    if (
      relative.startsWith("../") ||
      path.isAbsolute(relative) ||
      relative.split("/").includes("node_modules")
    )
      return undefined;
    return relative;
  };
  const compilerModule = (file: string): boolean =>
    (/\.[cm]?[jt]sx?$/.test(file) && !/\.d\.[cm]?ts$/.test(file)) ||
    /\.json$/.test(file);
  const sourceInput = (file: string): boolean => {
    const relative = relativeSource(file);
    return (
      relative !== undefined &&
      !isViewerWatchOutput(root, file) &&
      (/^(src|docs|assets|public|scripts|viewer|vendor|automovie)\//.test(
        relative,
      ) ||
        /\.[cm]?[jt]sx?$/.test(relative) ||
        /^[^/]+\.(?:json|ya?ml)$/.test(relative) ||
        importedInputs.has(relative))
    );
  };
  const rememberInput = (file: string): void => {
    const relative = relativeSource(file);
    if (relative !== undefined && !isViewerWatchOutput(root, file))
      importedInputs.add(relative);
  };
  const requireGeneration = (requested: string | null): void => {
    if (state.phase !== "ready") throw new Error(state.message);
    if (requested !== state.generation)
      throw new Error("Preview source generation changed. Reload the viewer.");
  };
  const emittedSource = (file: string): string => {
    const relative = relativeSource(file);
    if (relative === undefined || isViewerWatchOutput(root, file))
      throw new Error(
        `Preview source is outside the watched authoring tree: ${file}`,
      );
    const key = relative
      .replace(/\.mts$/, ".mjs")
      .replace(/\.cts$/, ".cjs")
      .replace(/\.tsx?$/, ".js")
      .replace(/\.jsx$/, ".js");
    const code = output.get(key);
    if (code === undefined)
      throw new Error(
        `ttsc emitted no preview module for ${relative}. Include the actual source in tsconfig.preview.json; declaration-only substitutes cannot supply its runtime.`,
      );
    return code;
  };
  return {
    name: "automovie-source-preview-builder",
    enforce: "pre",
    async resolveId(source, importer) {
      const requested = new URLSearchParams(source.split("?", 2)[1]).get(
        GENERATION_QUERY,
      );
      const inherited = new URLSearchParams(importer?.split("?", 2)[1]).get(
        GENERATION_QUERY,
      );
      const selected = requested ?? inherited;
      if (selected === null) return;
      requireGeneration(selected);
      const parameters = new URLSearchParams(source.split("?", 2)[1]);
      parameters.delete(GENERATION_QUERY);
      const specifier =
        source.split("?", 1)[0]! +
        (parameters.size === 0 ? "" : `?${parameters}`);
      const resolved = await this.resolve(
        specifier,
        importer?.split("?", 1)[0],
        { skipSelf: true },
      );
      if (resolved === null) return;
      const [file, query] = resolved.id.split("?", 2);
      if (file !== undefined) rememberInput(file);
      if (
        file === undefined ||
        !compilerModule(file) ||
        relativeSource(file) === undefined ||
        parameters.has("raw") ||
        parameters.has("url")
      )
        return resolved;
      emittedSource(file);
      const resolvedParameters = new URLSearchParams(query);
      resolvedParameters.set(GENERATION_QUERY, selected);
      return { ...resolved, id: `${file}?${resolvedParameters}` };
    },
    load(id) {
      const [file, query] = id.split("?", 2);
      if (file === undefined || !compilerModule(file)) return;
      const relative = relativeSource(file);
      // This fixed diagnostic shell can report a builder error before any
      // authored module exists. It contains no scene or production imports.
      const parameters = new URLSearchParams(query);
      if (
        relative === undefined ||
        relative === "viewer/src/sourcePreviewClient.js" ||
        parameters.has("raw") ||
        parameters.has("url")
      )
        return;
      requireGeneration(parameters.get(GENERATION_QUERY));
      return emittedSource(file);
    },
    handleHotUpdate: (context) => (sourceInput(context.file) ? [] : undefined),
    configureServer(server) {
      let running = false;
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const compile = async (): Promise<void> => {
        if (running || closed) return;
        running = true;
        const started = generation;
        const result = await new Promise<ITtscCompilerResult>((resolve) => {
          const worker = new Worker(
            path.join(root, "scripts/compileSourcePreview.mjs"),
            { workerData: { root } },
          );
          worker.once("message", resolve);
          worker.once("error", (error) =>
            resolve({ type: "exception", error: error.message }),
          );
          worker.once("exit", (code) =>
            resolve({
              type: "exception",
              error: `Source builder exited without a result (${code}).`,
            }),
          );
        }).catch(
          (error: unknown): ITtscCompilerResult => ({
            type: "exception",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        running = false;
        if (closed) return;
        if (started !== generation) {
          schedule();
          return;
        }
        if (result.type !== "exception")
          for (const diagnostic of result.diagnostics ?? [])
            if (typeof diagnostic.file === "string")
              rememberInput(path.resolve(root, diagnostic.file));
        if (result.type === "success") {
          const entries = Object.entries(result.output);
          if (
            result.output[`${OUTPUT_PREFIX}viewer/src/preview.js`] !==
              undefined &&
            entries.every(([file]) => file.startsWith(OUTPUT_PREFIX))
          ) {
            importedInputs.clear();
            for (const [file] of entries)
              if (file.endsWith(".json"))
                importedInputs.add(file.slice(OUTPUT_PREFIX.length));
            output = new Map(
              entries.map(([file, code]) => [
                file.slice(OUTPUT_PREFIX.length),
                code,
              ]),
            );
            state = {
              ...state,
              phase: "ready",
              message:
                "Current source compiled with ttsc. Production admission is separate.",
            };
            return;
          }
        }
        state = {
          ...state,
          phase: "error",
          message:
            "Preview source compilation refused. Previous output is not current.\n" +
            (result.type === "failure"
              ? JSON.stringify(result.diagnostics, null, 2)
              : result.type === "exception"
                ? JSON.stringify(result.error, null, 2)
                : "Keep the rootDir and outDir layout declared by tsconfig.preview.json."),
        };
        server.config.logger.error(state.message);
      };
      const schedule = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => void compile(), 250);
      };
      const invalidate = (): void => {
        generation++;
        output = new Map();
        state = {
          generation: `${session}-${generation}`,
          phase: "compiling",
          message: "Source changed. Compiling current preview with ttsc...",
        };
        server.moduleGraph.invalidateAll();
        schedule();
      };
      const changed = (file: string): void => {
        if (sourceInput(file)) invalidate();
      };
      const added = (file: string): void => {
        const relative = relativeSource(file);
        // A missing data import has no browser module yet. Its creation can
        // recover an already refused compilation without disrupting a view.
        if (
          sourceInput(file) ||
          (state.phase === "error" &&
            relative !== undefined &&
            /\.(?:json|ya?ml)$/.test(relative) &&
            !isViewerWatchOutput(root, file))
        )
          invalidate();
      };
      server.watcher.on("add", added);
      server.watcher.on("change", changed);
      server.watcher.on("unlink", changed);
      server.httpServer?.once("close", () => {
        closed = true;
        clearTimeout(timer);
        server.watcher.off("add", added);
        server.watcher.off("change", changed);
        server.watcher.off("unlink", changed);
        // A worker already inside the native compiler finishes normally.
      });
      server.middlewares.use((request, response, next) => {
        const requested = new URLSearchParams(
          request.url?.split("?", 2)[1],
        ).get(GENERATION_QUERY);
        if (
          requested !== null &&
          (state.phase !== "ready" || requested !== state.generation)
        ) {
          response.statusCode = 503;
          response.setHeader("Content-Type", "text/plain; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(
            "Preview source generation is unavailable. " + state.message,
          );
          return;
        }
        if (
          request.url?.split("?", 1)[0] !== "/__automovie/source-preview.json"
        ) {
          next();
          return;
        }
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(JSON.stringify(state));
      });
      changed(path.join(root, "viewer/preview.ts"));
    },
  };
};
