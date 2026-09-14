class ProductionEncoderCleanupError extends AggregateError {}

export interface IProductionEncoderOperationFailure {
  readonly error: unknown;
}

export interface IProductionEncoderCleanupResource {
  readonly resource: string;
  readonly cleanup: () => unknown;
}

/** Preserve one encoder operation failure while attempting every cleanup. */
export const preserveProductionEncoderCleanup = (
  failure: IProductionEncoderOperationFailure | undefined,
  resources: readonly IProductionEncoderCleanupResource[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
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
    throw cleanupFailures[0]!.error;
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
