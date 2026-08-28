/** Own the process listeners and abort signal for one repaint invocation. */
export const createProductionRepaintCancellationRuntime = (host: {
  once(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  removeListener(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
}) => {
  const controller = new AbortController();
  const interrupt = (): void =>
    controller.abort(new Error("Repaint interrupted by SIGINT."));
  const terminate = (): void =>
    controller.abort(new Error("Repaint interrupted by SIGTERM."));
  const listeners = [
    { signal: "SIGINT", listener: interrupt },
    { signal: "SIGTERM", listener: terminate },
  ] as const;
  return {
    signal: controller.signal,
    attach: () => {
      for (const entry of listeners) host.once(entry.signal, entry.listener);
    },
    closeCapture: async (failure, close) => {
      for (const entry of listeners)
        host.removeListener(entry.signal, entry.listener);
      await close(failure);
    },
  };
};
