class ProductionEncoderCleanupError extends AggregateError {}

/**
 * Preserve one encoder operation failure while attempting every cleanup.
 *
 * @param {{ error: unknown } | undefined} failure
 * @param {readonly { resource: string; cleanup: () => unknown }[]} resources
 * @returns {void}
 */
const preserveProductionEncoderCleanup = (failure, resources) => {
  const cleanupFailures = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 0) {
    if (failure !== undefined) throw failure.error;
    return;
  }
  if (failure === undefined && cleanupFailures.length === 1)
    throw cleanupFailures[0].error;
  throw new ProductionEncoderCleanupError(
    [
      ...(failure === undefined ? [] : [failure.error]),
      ...cleanupFailures.map((entry) => entry.error),
    ],
    `Production encoder cleanup failed${
      failure === undefined ? "" : " after the operation failed"
    }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
  );
};

module.exports = { preserveProductionEncoderCleanup };
