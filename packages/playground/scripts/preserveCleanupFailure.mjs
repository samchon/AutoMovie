/**
 * Run one fallible direct-script cleanup without replacing an earlier failure.
 *
 * @param {{ error: unknown } | undefined} failure
 * @param {string} resource
 * @param {() => unknown} cleanup
 * @returns {Promise<void>}
 */
export const preserveCleanupFailure = async (failure, resource, cleanup) => {
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
