import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

interface ICancellationRuntime {
  signal: AbortSignal;
  attach(): void;
  closeCapture<Failure>(
    failure: Failure,
    close: (failure: Failure) => Promise<void>,
  ): Promise<void>;
}

interface ICancellationModule {
  createProductionRepaintCancellationRuntime(host: {
    once(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
    removeListener(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  }): ICancellationRuntime;
}

const exercise = async (
  label: string,
  module: ICancellationModule,
): Promise<void> => {
  const interruptBus = new EventEmitter();
  const interrupt =
    module.createProductionRepaintCancellationRuntime(interruptBus);
  interrupt.attach();
  interruptBus.emit("SIGINT");
  const forwarded = new Error(`${label} primary failure`);
  let received: unknown;
  const closeTypedFailure = (failure: Error): Promise<void> => {
    received = failure;
    return Promise.resolve();
  };
  await interrupt.closeCapture(forwarded, closeTypedFailure);

  const terminateBus = new EventEmitter();
  const terminate =
    module.createProductionRepaintCancellationRuntime(terminateBus);
  terminate.attach();
  terminateBus.emit("SIGTERM");
  await terminate.closeCapture(undefined, () => Promise.resolve());

  TestValidator.equals(
    `${label} owns both interrupt reasons, primary failure, and listener cleanup`,
    {
      interrupt: (interrupt.signal.reason as Error).message,
      terminate: (terminate.signal.reason as Error).message,
      received,
      interruptListeners: ["SIGINT", "SIGTERM"].map((signal) =>
        interruptBus.listenerCount(signal),
      ),
      terminateListeners: ["SIGINT", "SIGTERM"].map((signal) =>
        terminateBus.listenerCount(signal),
      ),
    },
    {
      interrupt: "Repaint interrupted by SIGINT.",
      terminate: "Repaint interrupted by SIGTERM.",
      received: forwarded,
      interruptListeners: [0, 0],
      terminateListeners: [0, 0],
    },
  );
};

/**
 * Repaint cancellation is identical in source and every generated project.
 *
 * The lifecycle is exercised through a deterministic signal bus rather than a
 * platform-dependent child-process interrupt. That observes the exact abort
 * reason, failure forwarding, and cleanup semantics the CLI consumes while the
 * generated-copy half proves the scaffold did not omit or rewrite the runtime.
 *
 * Scenarios:
 *
 * 1. SIGINT aborts with its named reason, forwards the primary failure to the
 *    capture closer, and removes both listeners.
 * 2. SIGTERM independently aborts with its named reason and removes both
 *    listeners.
 * 3. The repository source and scaffold-rendered generated copy satisfy the
 *    same lifecycle contract.
 */
export const test_cli_scaffold_repaint_cancellation_runtime =
  async (): Promise<void> => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-repaint-cancellation-"),
    );
    let failure: { error: unknown } | undefined;
    try {
      const project = path.join(root, "generated");
      writeFiles(project, renderScaffold({ name: "repaint-cancellation" }));
      const generated = createRequire(__filename)(
        path.join(project, "scripts", "repaintCancellationRuntime.ts"),
      ) as ICancellationModule;
      const source = createRequire(__filename)(
        path.resolve(
          __dirname,
          "../../../../packages/template/scaffold/scripts/repaintCancellationRuntime.ts",
        ),
      ) as ICancellationModule;
      await exercise("repository source", source);
      await exercise("generated project", generated);
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      preserveCliRootFixtureCleanup(
        failure,
        () => fs.rmSync(root, { recursive: true, force: true }),
        "repaint cancellation fixture",
      );
    }
  };
