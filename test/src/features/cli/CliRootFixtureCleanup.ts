interface ICliRootFixtureFailure {
  error: unknown;
}

class CliRootFixtureCleanupError extends AggregateError {}

/** Remove one owned CLI fixture root without replacing its primary failure. */
export const preserveCliRootFixtureCleanup = (
  failure: ICliRootFixtureFailure | undefined,
  cleanup: () => unknown,
  resource: string,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new CliRootFixtureCleanupError(
      [failure.error, cleanupFailure],
      `CLI ${resource} cleanup failed after the test failed.`,
    );
  }
};
