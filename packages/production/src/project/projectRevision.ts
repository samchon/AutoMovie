/** One decoded project revision and whether it can advance once more. */
export type AutoMovieProjectRevisionDecision =
  | {
      /** The persisted value belongs to the project-revision domain. */
      state: "current";
      /** The current non-negative safe integer. */
      revision: number;
    }
  | {
      /** A present record did not contain one valid revision. */
      state: "invalid";
    };

/** The outcome of asking one current project revision to advance. */
export type AutoMovieProjectRevisionAdvance =
  | {
      /** The current revision has one exactly representable successor. */
      state: "next";
      /** The successor to publish after the guarded mutation succeeds. */
      revision: number;
    }
  | {
      /** The current value is outside the revision domain. */
      state: "invalid";
    }
  | {
      /** The current value is valid but has no safe-integer successor. */
      state: "exhausted";
    };

/**
 * Decode one optional project-revision record without treating malformed data
 * as the legacy missing-file default.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-late-writer-fencing Keeps the optimistic revision fence inside one exact integer domain before a writer can act on it.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-fencing-late-writer Implements the current-generation comparison with an exactly representable counter.
 */
export const decodeAutoMovieProjectRevision = (
  value: unknown,
): AutoMovieProjectRevisionDecision => {
  if (value === undefined) return { state: "current", revision: 0 };
  const revision = (value as { revision?: unknown } | null)?.revision;
  return typeof revision === "number" &&
    Number.isSafeInteger(revision) &&
    revision >= 0
    ? { state: "current", revision }
    : { state: "invalid" };
};

/**
 * Decide the next project revision before any guarded mutation writes bytes.
 *
 * @evidence requirements/operations-and-recovery/concurrent-runs-and-locking.md#operations-late-writer-fencing Refuses a writer whose current revision cannot name one exact successor.
 * @evidence specifications/execution-and-recovery/concurrent-ownership-and-locking.md#execution-fencing-late-writer Produces the exact successor generation used by the mutation fence.
 */
export const advanceAutoMovieProjectRevision = (
  revision: number,
): AutoMovieProjectRevisionAdvance => {
  if (Number.isSafeInteger(revision) === false || revision < 0)
    return { state: "invalid" };
  if (revision === Number.MAX_SAFE_INTEGER) return { state: "exhausted" };
  return { state: "next", revision: revision + 1 };
};
