/** Failure retained while a resource is being released. */
export interface IAutoMoviePlaygroundOperationFailure {
  error: unknown;
}

/**
 * Run one fallible cleanup without replacing an earlier operation failure.
 *
 * @param failure - Earlier operation failure, when one exists.
 * @param resource - Resource label for a combined failure.
 * @param cleanup - Fallible resource release.
 */
export const preserveCleanupFailure = async (
  failure: IAutoMoviePlaygroundOperationFailure | undefined,
  resource: string,
  cleanup: () => unknown,
): Promise<void> => {
  try {
    await cleanup();
  } catch (cleanupError) {
    if (failure === undefined) throw cleanupError;
    throw new AggregateError(
      [failure.error, cleanupError],
      `${resource} cleanup failed after the operation failed.`,
    );
  }
};
