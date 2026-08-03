interface ICliHarnessFailure {
  error: unknown;
}

interface ICliHarnessCleanup {
  cleanup: () => unknown;
  resource: string;
}

class CliHarnessCleanupError extends AggregateError {}

/** Attempt every CLI harness cleanup without hiding the captured failure. */
export const preserveCliHarnessCleanup = (
  failure: ICliHarnessFailure | undefined,
  resources: readonly ICliHarnessCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new CliHarnessCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `CLI harness cleanup failed${
        failure === undefined ? "" : " after the operation failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};
