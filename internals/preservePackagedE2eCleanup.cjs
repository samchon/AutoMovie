class PackagedE2eCleanupError extends AggregateError {}

/**
 * Run one packaged-E2E cleanup without replacing an earlier probe failure.
 *
 * @param {{ error: unknown } | undefined} failure
 * @param {string} resource
 * @param {() => unknown} cleanup
 * @returns {void}
 */
const preservePackagedE2eCleanup = (failure, resource, cleanup) => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new PackagedE2eCleanupError(
      [failure.error, cleanupFailure],
      `${resource} cleanup failed after the packaged E2E operation failed.`,
    );
  }
};

module.exports = { preservePackagedE2eCleanup };
