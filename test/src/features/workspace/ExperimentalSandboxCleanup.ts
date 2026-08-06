interface IExperimentalSandboxFailure {
  error: unknown;
}

class ExperimentalSandboxCleanupError extends AggregateError {}

/**
 * Remove one owned experimental sandbox without replacing its primary failure.
 * A cleanup that throws after the test already failed would otherwise hide the
 * defect behind a filesystem error.
 */
export const preserveExperimentalSandboxCleanup = (
  failure: IExperimentalSandboxFailure | undefined,
  cleanup: () => unknown,
  resource: string,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ExperimentalSandboxCleanupError(
      [failure.error, cleanupFailure],
      `experimental ${resource} cleanup failed after the test failed.`,
    );
  }
};
