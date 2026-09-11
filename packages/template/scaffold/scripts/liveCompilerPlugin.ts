import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin } from "vite";

import { isViewerWatchOutput } from "./viewerWatchOptions";

/** Reexecute source in a fresh ttsx process before serving a new generation. */
export const liveCompilerPlugin = (root: string): Plugin => {
  let generation = 0;
  let state: {
    generation: number;
    phase: "compiling" | "ready" | "error";
    message: string;
  } = {
    generation,
    phase: "compiling",
    message: "Compiling current production source...",
  };
  return {
    name: "automovie-live-builder",
    transformIndexHtml: {
      order: "pre",
      handler: () => [
        {
          tag: "script",
          attrs: { type: "module", src: "/viewer/src/liveCompilerClient.ts" },
          injectTo: "head-prepend",
        },
      ],
    },
    configureServer: (server) => {
      let running = false;
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const require = createRequire(path.join(root, "package.json"));
      const manifestPath = require.resolve("ttsc/package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        bin: { ttsx: string };
      };
      const launcher = path.resolve(
        path.dirname(manifestPath),
        manifest.bin.ttsx,
      );

      const compile = async (): Promise<void> => {
        if (running || closed) return;
        running = true;
        const started = generation;
        let output = "";
        const append = (chunk: Buffer): void => {
          const text = chunk.toString();
          process.stdout.write(text);
          output = (output + text).slice(-16000);
        };
        // No shell or module cache survives this invocation. The same entry,
        // flags, checks and publication owner as `npm run build` run here.
        const code = await new Promise<number>((resolve) => {
          const child = spawn(
            process.execPath,
            [
              launcher,
              "--cache-dir",
              "node_modules/.cache/ttsc",
              "-P",
              "tsconfig.json",
              "scripts/build.ts",
            ],
            { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
          );
          child.stdout.on("data", append);
          child.stderr.on("data", append);
          child.on("error", (error) => {
            output = error.message;
            resolve(1);
          });
          child.on("close", (exitCode) => resolve(exitCode ?? 1));
        });
        running = false;
        if (closed) return;
        if (started !== generation) {
          // A save during compilation cannot authorize the intermediate bytes.
          // The builder owns publication; this server withholds those bytes
          // until the queued generation has completed its own admission.
          schedule();
          return;
        }
        state = {
          generation,
          phase: code === 0 ? "ready" : "error",
          message:
            code === 0
              ? "Current source compiled."
              : `Compilation refused. Previous output is not current.\n${output}`,
        };
      };
      const schedule = (): void => {
        clearTimeout(timer);
        timer = setTimeout(() => void compile(), 250);
      };
      const changed = (file: string): void => {
        if (isLiveCompilerInput(root, file) === false) return;
        generation++;
        state = {
          generation,
          phase: "compiling",
          message: "Source changed. Compiling current production...",
        };
        schedule();
      };
      server.watcher.on("add", changed);
      server.watcher.on("change", changed);
      server.watcher.on("unlink", changed);
      server.httpServer?.once("close", () => {
        closed = true;
        clearTimeout(timer);
        server.watcher.off("add", changed);
        server.watcher.off("change", changed);
        server.watcher.off("unlink", changed);
        // Let a builder already holding its project lease finish normally.
        // Terminating only ttsx would orphan its synchronous runtime child.
      });
      server.middlewares.use((request, response, next) => {
        const route = request.url?.split("?", 1)[0];
        if (route === "/__automovie/live-builder.json") {
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(JSON.stringify(state));
          return;
        }
        if (route?.startsWith("/__automovie/") && state.phase !== "ready") {
          response.statusCode = 503;
          response.setHeader("Content-Type", "text/plain; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(state.message);
          return;
        }
        next();
      });
      changed(path.join(root, "scripts", "compile.ts"));
    },
  };
};

/** Authored inputs only; builder state and observation writes cannot loop. */
const isLiveCompilerInput = (root: string, file: string): boolean => {
  if (isViewerWatchOutput(root, file)) return false;
  const relative = path.relative(root, file).split(path.sep).join("/");
  if (relative.startsWith("../") || path.isAbsolute(relative)) return false;
  if (/^(src|docs|assets|scripts|viewer|vendor)\//.test(relative)) return true;
  if (/^automovie\/(design|derived|contract-migrations)\//.test(relative))
    return true;
  if (
    /^automovie\/(assets|derived-artifacts|contracts-baseline)\.json$/.test(
      relative,
    )
  )
    return true;
  return (
    /\.[cm]?[jt]sx?$/.test(relative) || /^[^/]+\.(?:json|ya?ml)$/.test(relative)
  );
};
