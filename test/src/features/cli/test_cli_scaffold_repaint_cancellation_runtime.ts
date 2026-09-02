import { TestValidator } from "@nestia/e2e";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import path from "node:path";

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
 * Repaint cancellation preserves abort reason, failure, and cleanup.
 *
 * The lifecycle is exercised through a deterministic signal bus rather than a
 * platform-dependent child-process interrupt. That observes the exact abort
 * reason, failure forwarding, and cleanup semantics the CLI consumes.
 *
 * Scenarios:
 *
 * 1. SIGINT aborts with its named reason, forwards the primary failure to the
 *    capture closer, and removes both listeners.
 * 2. SIGTERM independently aborts with its named reason and removes both
 *    listeners.
 */
export const test_cli_scaffold_repaint_cancellation_runtime =
  async (): Promise<void> => {
    const source = createRequire(__filename)(
      path.resolve(
        __dirname,
        "../../../../packages/template/scaffold/scripts/repaintCancellationRuntime.ts",
      ),
    ) as ICancellationModule;
    await exercise("repaint cancellation", source);
  };
