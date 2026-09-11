import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { finished } from "node:stream/promises";
import { StringDecoder } from "node:string_decoder";

import {
  type IBenchmarkCommand,
  type IBenchmarkTurnPlan,
  assertBenchmarkTurnPlan,
  benchmarkCheckProgress,
  benchmarkLiveness,
  runBenchmarkVerification,
} from "./benchmarkObservation";

/** Run one turn under a timer; the coordinator owns continuation and judgment. */
const main = async (): Promise<void> => {
  const [planFile, outputParent, ...extra] = process.argv.slice(2);
  if (
    planFile === undefined ||
    outputParent === undefined ||
    extra.length !== 0
  )
    throw new Error(
      "Usage: pnpm benchmark:turn <plan.json> <private-receipt-directory>",
    );
  const source = fs.readFileSync(planFile);
  const plan = JSON.parse(
    source.toString("utf8").replace(/^\uFEFF/u, ""),
  ) as IBenchmarkTurnPlan;
  assertBenchmarkTurnPlan(plan);
  const directory = path.dirname(path.resolve(planFile));
  const cwd = path.resolve(directory, plan.cwd);
  if (!fs.statSync(cwd).isDirectory())
    throw new Error("Benchmark cwd is not a directory.");
  const prompt = fs.readFileSync(path.resolve(directory, plan.promptFile));
  const basis = fs.readFileSync(path.resolve(directory, plan.basisFile));
  const digest = (bytes: Uint8Array) =>
    "sha256:" + createHash("sha256").update(bytes).digest("hex");
  const attempt = randomUUID();
  fs.mkdirSync(outputParent, { recursive: true });
  const root = path.join(path.resolve(outputParent), attempt);
  fs.mkdirSync(root);
  const ledger = path.join(root, "observations.jsonl");
  let sequence = 0;
  const record = (event: Record<string, unknown>): void => {
    fs.appendFileSync(
      ledger,
      JSON.stringify({
        runId: plan.runId,
        generation: plan.generation,
        attempt,
        sequence: ++sequence,
        observedAt: new Date().toISOString(),
        ...event,
      }) + "\n",
      "utf8",
    );
  };
  record({
    kind: "declared",
    cwd,
    planDigest: digest(source),
    basisDigest: digest(basis),
    promptDigest: digest(prompt),
    requestedModel: plan.requestedModel,
    actualModel: null,
    pollMs: plan.pollMs,
    stallMs: plan.stallMs,
  });
  process.stdout.write(`Benchmark receipts: ${root}\n`);
  let interrupted = false;

  const run = async (
    command: IBenchmarkCommand,
    label: string,
    input?: Uint8Array,
  ) => {
    const stdout = fs.createWriteStream(
      path.join(root, `${label}.stdout.log`),
      { flags: "wx" },
    );
    const stderr = fs.createWriteStream(
      path.join(root, `${label}.stderr.log`),
      { flags: "wx" },
    );
    const child = spawn(command.executable, command.args, {
      cwd,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const spawnedAt = Date.now();
    let bytes = 0;
    let previousBytes = 0;
    let lastProgress = performance.now();
    let lastProgressAt = spawnedAt;
    let previousArtifacts = "";
    let errorCode: string | null = null;
    let pending = "";
    const decoder = new StringDecoder("utf8");
    const sessionIds = new Set<string>();
    const observe = (event: Record<string, unknown>): void => {
      try {
        record(event);
      } catch {
        errorCode = "observer-write-error";
        process.stderr.write(
          `Cannot persist benchmark observation; stopping owned process ${String(child.pid)}.\n`,
        );
        child.kill();
      }
    };
    const interrupt = (): void => {
      interrupted = true;
      errorCode = "observer-interrupted";
      observe({
        kind: "interruption",
        label,
        pid: child.pid,
        action: "stop owned process",
      });
      child.kill();
    };
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    // Attach failures before any bytes arrive; a disk error must not silently
    // disable observation while the author continues running.
    const flushed = Promise.all([finished(stdout), finished(stderr)]).catch(
      () => {
        errorCode = "log-write-error";
        observe({
          kind: "observer-error",
          label,
          code: errorCode,
          pid: child.pid,
        });
        child.kill();
      },
    );
    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      pending += decoder.write(chunk);
      const lines = pending.split("\n");
      pending = lines.pop()!;
      if (pending.length > 1024 * 1024) pending = "";
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as {
            type?: string;
            thread_id?: string;
          };
          if (
            event.type === "thread.started" &&
            typeof event.thread_id === "string" &&
            !sessionIds.has(event.thread_id)
          ) {
            sessionIds.add(event.thread_id);
            observe({
              kind: "session-observed",
              label,
              sessionId: event.thread_id,
            });
          }
        } catch {
          /* Ordinary output is retained in the private raw log. */
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
    });
    child.on("spawn", () =>
      observe({
        kind: "process-started",
        label,
        pid: child.pid,
        spawnedAt: new Date(spawnedAt).toISOString(),
        identityBasis: "owned ChildProcess handle; not a later PID lookup",
      }),
    );
    child.on("error", (error: NodeJS.ErrnoException) => {
      errorCode = error.code ?? "process-error";
    });
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      errorCode = error.code ?? "stdin-error";
      observe({
        kind: "stdin-error",
        label,
        code: error.code ?? "stdin-error",
      });
    });
    child.stdin.end(input);
    const sample = (): void => {
      const now = performance.now();
      const artifacts = plan.artifacts.map((relative) => {
        try {
          const stat = fs.statSync(path.resolve(cwd, relative));
          return { path: relative, bytes: stat.size, modifiedMs: stat.mtimeMs };
        } catch {
          return { path: relative, unavailable: true };
        }
      });
      const currentArtifacts = JSON.stringify(artifacts);
      const advanced =
        bytes > previousBytes ||
        (previousArtifacts !== "" && currentArtifacts !== previousArtifacts);
      if (advanced) {
        lastProgress = now;
        lastProgressAt = Date.now();
      }
      observe({
        kind: "liveness",
        label,
        pid: child.pid,
        disposition: benchmarkLiveness({
          now,
          lastProgress,
          advanced,
          stallMs: plan.stallMs,
        }),
        outputBytes: bytes,
        outputGrowth: bytes - previousBytes,
        artifacts,
        lastProgressAt: new Date(lastProgressAt).toISOString(),
        nextObservationDue: new Date(Date.now() + plan.pollMs).toISOString(),
      });
      previousBytes = bytes;
      previousArtifacts = currentArtifacts;
    };
    sample();
    const timer = setInterval(sample, plan.pollMs);
    const result = await new Promise<{
      exitCode: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve) => {
      child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
    });
    clearInterval(timer);
    await flushed;
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    observe({
      kind: "process-terminal",
      label,
      pid: child.pid,
      ...result,
      errorCode,
      outputBytes: bytes,
      taskCompletion: "unverified",
    });
    return (
      result.exitCode === 0 && result.signal === null && errorCode === null
    );
  };

  const authorSucceeded = await run(plan.command, "author", prompt);
  let basisCurrent = false;
  try {
    basisCurrent =
      digest(fs.readFileSync(path.resolve(directory, plan.basisFile))) ===
      digest(basis);
  } catch {
    /* Missing basis cannot authorize verification against this run. */
  }
  record({ kind: "basis-rechecked", current: basisCurrent });
  const checks = await runBenchmarkVerification({
    checks: plan.checks,
    enabled: authorSucceeded && basisCurrent,
    isInterrupted: () => interrupted,
    run: (command, index) => run(command, `check-${index}`),
    observe: (checks) =>
      record({
        kind: "check-progress",
        checks,
        progress: benchmarkCheckProgress(checks),
      }),
  });
  record({
    kind: "turn-terminal",
    authorSucceeded,
    basisCurrent,
    interrupted,
    checks,
    progress: benchmarkCheckProgress(checks),
    nextAction:
      "coordinator reviews evidence and chooses continuation, failure or completion",
    automaticRetry: false,
  });
  process.stdout.write(
    JSON.stringify({
      receipts: root,
      authorSucceeded,
      progress: benchmarkCheckProgress(checks),
    }) + "\n",
  );
  process.exitCode =
    authorSucceeded &&
    basisCurrent &&
    checks.every((check) => check.status === "passed")
      ? 0
      : 1;
};

void main().catch((error: unknown) => {
  process.stderr.write(
    `Benchmark observer failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
