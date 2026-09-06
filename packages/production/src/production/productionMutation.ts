/**
 * Apply owned writes, recording publication before any later step can fail.
 *
 * The adapter calls `published` immediately after its atomic mutation. Until
 * `committed` marks the revision publication, a failure restores exactly those
 * writes in reverse order while the namespace is still owned. A committed
 * revision is never rolled back as though its acknowledgement had not failed.
 */
export const runProductionMutation = <File, Result>(props: {
  /** Ordered candidate writes with their previous values. */
  files: readonly File[];
  /** Refuse a replaced namespace before touching its paths. */
  guard: () => void;
  /** Publish one write and notify before post-publication guards or cleanup. */
  apply: (file: File, published: () => void) => void;
  /** Restore one already-published write to its previous value. */
  restore: (file: File) => void;
  /** Validate the complete closure, then mark the revision's commit point. */
  complete: (committed: () => void) => Result;
}): Result => {
  const applied: File[] = [];
  let committed = false;
  try {
    for (const file of props.files) {
      props.guard();
      props.apply(file, () => {
        applied.push(file);
        props.guard();
      });
      props.guard();
    }
    return props.complete(() => {
      committed = true;
    });
  } catch (error) {
    if (committed)
      throw new AggregateError(
        [error],
        "Production revision was committed, but a later guard or cleanup failed. No rollback was attempted after the revision commit point. Reopen the project and inspect the current revision and publication before retrying.",
      );
    try {
      props.guard();
    } catch (identityError) {
      throw new AggregateError(
        [error, identityError],
        "Production mutation stopped because the physical root, namespace fence, or state incarnation changed. No stale-path rollback was attempted in the replacement namespace.",
      );
    }
    const rollbackErrors: unknown[] = [];
    for (const file of applied.reverse())
      try {
        props.guard();
        props.restore(file);
        props.guard();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    if (rollbackErrors.length !== 0)
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Production mutation failed and rollback was incomplete. Restore the listed owned files before retrying.",
      );
    throw error;
  }
};

/** Keep both failures, or name cleanup after a successful atomic operation. */
export const cleanupProductionAtomic = (
  temporary: string,
  failure: { error: unknown } | undefined,
  remove: () => void,
): void => {
  try {
    remove();
  } catch (cleanupFailure) {
    throw new AggregateError(
      failure === undefined
        ? [cleanupFailure]
        : [failure.error, cleanupFailure],
      failure === undefined
        ? `Production atomic operation completed, but temporary cleanup failed: ${temporary}. Inspect the committed state before retrying.`
        : `Production atomic cleanup failed after the operation failed: ${temporary}.`,
    );
  }
};

/** Restore a quarantined deletion only while its namespace is still owned. */
export const recoverProductionAtomicDelete = (props: {
  /** Owned path whose deletion failed. */
  file: string;
  /** Original deletion or cleanup failure. */
  error: unknown;
  /** Refuse recovery in a replacement namespace. */
  guard: () => void;
  /** Whether the original quarantined entry remains available. */
  quarantined: () => boolean;
  /** Whether the original target path is occupied again. */
  occupied: () => boolean;
  /** Restore only the unoccupied target from its retained quarantine. */
  restore: () => void;
}): never => {
  try {
    props.guard();
    if (props.quarantined() && props.occupied() === false) {
      props.guard();
      props.restore();
      props.guard();
    }
  } catch (recoveryFailure) {
    throw new AggregateError(
      [props.error, recoveryFailure],
      `Production atomic delete recovery failed after the operation failed: ${props.file}.`,
    );
  }
  throw props.error;
};
