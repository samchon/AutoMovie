import { spawn } from "node:child_process";
import { watch } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { createPortraitWebBuildGate } from "./logic.mjs";

/** Keep the HTTP viewer alive even when the required ttsx project gate refuses. */
export async function startPortraitWatch(root, onStatus) {
  const gate = createPortraitWebBuildGate();
  const work = path.join(root, ".shots/face-web-work");
  await fs.mkdir(work, { recursive: true });
  const launcher = path.join(
    root,
    "test/node_modules/ttsc/lib/launcher/ttsx.js",
  );
  const args = [
    launcher,
    "-P",
    "test/tsconfig.scripts.json",
    "test/scripts/face-review/export.ts",
  ];
  const command =
    "ttsx -P test/tsconfig.scripts.json test/scripts/face-review/export.ts";
  let timer;
  let child;
  let generation = 0;
  const session = Date.now();
  let closed = false;

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void rebuild();
    }, 500);
  }
  function changed() {
    gate.request();
    schedule();
  }
  async function rebuild() {
    if (closed || !gate.start()) return;
    const current = ++generation;
    const log = path.join(work, `ttsx-export-${session}-${current}.log`);
    const details = {
      generation: current,
      command,
      log: path.relative(root, log).replaceAll(path.sep, "/"),
    };
    onStatus({
      ...details,
      state: "building",
      message: "ttsx is checking and exporting the changed source.",
    });
    console.log("BUILD", command);
    let output = "";
    let lease;
    const lock = path.join(root, ".shots/face-experiment/preview.lock");
    try {
      try {
        lease = await fs.open(lock, "wx");
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        gate.request();
        onStatus({
          ...details,
          state: "waiting",
          message:
            "Waiting for the active portrait publisher to release its lease.",
        });
        return;
      }
      const exitCode = await new Promise((resolve, reject) => {
        child = spawn(process.execPath, args, {
          cwd: root,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        child.stdout.on("data", (bytes) => {
          output += bytes.toString();
        });
        child.stderr.on("data", (bytes) => {
          output += bytes.toString();
        });
        child.on("error", reject);
        child.on("close", (code, signal) =>
          resolve(signal === null ? code : `signal ${signal}`),
        );
      });
      await fs.writeFile(log, output);
      if (exitCode !== 0)
        throw new Error(
          `ttsx export failed (${exitCode}).\n${output.replace(/\x1b\[[0-9;]*m/g, "").slice(-5000)}`,
        );
      onStatus({
        ...details,
        state: "succeeded",
        message:
          "ttsx export completed; waiting for a verified artifact snapshot.",
      });
      console.log("EXPORTED", current);
    } catch (error) {
      onStatus({ ...details, state: "failed", message: error.message });
      console.error(
        "EXPORT FAILED",
        error.message.slice(0, 350),
        "Full log:",
        details.log,
      );
    } finally {
      child = undefined;
      if (lease) {
        await lease.close();
        await fs.unlink(lock);
      }
      if (gate.finish() && !closed) schedule();
    }
  }
  const roots = [
    "test/src/subjects",
    "packages/engine/src",
    "packages/interface/src",
    "config",
    "docs",
  ];
  const watchers = roots.map((directory) =>
    watch(path.join(root, directory), { recursive: true }, (_event, file) => {
      if (file !== null && /\.(?:ts|json|md)$/.test(file.toString())) changed();
    }),
  );
  watchers.push(
    watch(path.join(root, "test/scripts/face-review"), (_event, file) => {
      if (file !== null && file.toString().endsWith(".ts")) changed();
    }),
  );
  for (const filename of [
    "test/tsconfig.json",
    "test/tsconfig.scripts.json",
    "test/lint.config.ts",
    "test/package.json",
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
  ])
    watchers.push(watch(path.join(root, filename), changed));
  for (const watcher of watchers)
    watcher.on("error", (error) =>
      onStatus({
        state: "failed",
        command,
        message: `Source watch failed: ${error.message}`,
      }),
    );
  changed();
  return () => {
    closed = true;
    clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
    // The ttsx launcher owns a native child. Let an in-flight export complete
    // and release its lease instead of orphaning the native writer on shutdown.
  };
}
