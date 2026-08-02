/* eslint-disable */
const fs = require("fs");

class PlaygroundBundleCleanupError extends AggregateError {}

/** Remove one launcher bundle without replacing an earlier failure. */
const preserveBundleCleanupFailure = (bundlePath, failure) => {
  try {
    fs.rmSync(bundlePath, { force: true });
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new PlaygroundBundleCleanupError(
      [failure.error, cleanupFailure],
      `Playground launcher bundle cleanup failed after the operation failed: ${bundlePath}.`,
    );
  }
};

module.exports = { preserveBundleCleanupFailure };
