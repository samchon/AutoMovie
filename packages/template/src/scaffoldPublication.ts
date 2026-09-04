import * as path from "node:path";

/**
 * One fully validated file in an immutable scaffold publication candidate.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Keeps the exact relative path, target, and bytes stable across one publication attempt.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Supplies a closed candidate whose identity can be reused without rebuilding it from mutable inputs.
 * @author Samchon
 */
export interface IScaffoldPublicationEntry {
  /**
   * Exact UTF-8 bytes selected before mutation begins.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Pins the bytes reused by one deterministic publication attempt.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Prevents a retry from rebuilding different bytes from mutable text.
   */
  bytes: Uint8Array;
  /**
   * Portable authored path used in diagnostics and receipts.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Retains the logical file identity attached to the candidate bytes.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Names the same logical result across retry and recovery.
   */
  relative: string;
  /**
   * Absolute lexical target proved to remain below the candidate root.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission Names the exact final slot whose competitor must be refused.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-duplicate-submission Binds duplicate handling to one prevalidated target.
   */
  target: string;
}

/**
 * Outcome reported by the parent-bound adapter for one candidate entry.
 *
 * The adapter reports rather than throws because a thrown I/O error cannot say
 * whether a final slot already exists. A partial outcome names the securely
 * bound parent generation and exact byte count without authorizing cleanup.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Preserves the exact local partial state a caller must reconcile after publication stops.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Distinguishes a zero-publication refusal from a bound partial result without deleting either generation.
 * @author Samchon
 */
export type ScaffoldFilePublicationOutcome =
  | {
      /** Complete, read-back-verified publication in the captured parent. */
      status: "completed";
      /**
       * Captured physical parent generation used by the native operation.
       *
       * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Identifies the physical owner of the completed result.
       * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Proves completion occurred in the generation selected for reuse.
       */
      parentIdentity: string;
    }
  | {
      /** Refusal before a final slot was created. */
      status: "refused";
      /**
       * Exact native or validation cause retained for the caller.
       *
       * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Retains why publication stopped before producing an effect.
       * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Distinguishes refusal from a result eligible for adoption.
       */
      error: unknown;
    }
  | {
      /** A final slot exists in the captured parent but is not complete. */
      status: "partial";
      /**
       * Number of candidate bytes known to have reached the bound slot.
       *
       * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Measures the partial effect without guessing from a reopened path.
       * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Supplies the exact extent considered for recovery or adoption.
       */
      bytesWritten: number;
      /**
       * Exact native or validation cause retained for the caller.
       *
       * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Retains the failure paired with the measured partial effect.
       * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Keeps recovery tied to the observed failure rather than a reconstructed guess.
       */
      error: unknown;
      /**
       * Captured physical parent generation containing the partial slot.
       *
       * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Names the generation that owns the partial effect.
       * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Prevents recovery from following a successor pathname generation.
       */
      parentIdentity: string;
    };

/**
 * Complete observable result of attempting one immutable candidate.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Records every completed entry and the exact stopping entry so recovery never guesses which mutable pathname to remove.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Makes adoption or retry a decision over a durable outcome class rather than an exception with unknown effects.
 * @author Samchon
 */
export interface IScaffoldPublicationReceipt {
  /**
   * Entries completed before the attempt stopped.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Records the exact completed prefix that recovery must preserve.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Identifies which results are candidates for adoption rather than cleanup.
   */
  completed: readonly IScaffoldPublicationEntry[];
  /**
   * Stopping entry and its exact one-file outcome, or `null` on success.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Couples the first unfinished target to its observed effect class.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Makes the recovery input explicit and generation-aware.
   */
  failure: {
    entry: IScaffoldPublicationEntry;
    outcome: Exclude<ScaffoldFilePublicationOutcome, { status: "completed" }>;
  } | null;
  /**
   * Complete candidate attempted by this receipt.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Preserves the closed intended result beside its attempt outcome.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Lets a retry reuse exactly the candidate that produced the receipt.
   */
  planned: readonly IScaffoldPublicationEntry[];
  /**
   * Candidate-wide result derived from completed and stopping entries.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Separates complete, zero-publication, and partial outcomes for recovery.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Gives adoption logic one explicit outcome class.
   */
  status: "completed" | "partial" | "refused";
}

/**
 * Validate the whole rendered file map before any directory or file mutation.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Freezes deterministic target and byte identities before the write attempt begins.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Refuses escape, invalid content, and portable collision before a target generation is created.
 * @author Samchon
 */
export const planScaffoldPublication = (props: {
  files: Readonly<Record<string, string>>;
  root: string;
}): readonly IScaffoldPublicationEntry[] => {
  const root = path.resolve(props.root);
  const entries = Object.entries(props.files).map(([relative, content]) => {
    if (typeof content !== "string")
      throw new Error(`scaffold content is not text: ${relative}`);
    if (relative.includes("\0"))
      throw new Error(`refusing invalid scaffold path: ${relative}`);
    const target = path.resolve(root, relative);
    const inside = path.relative(root, target);
    if (
      inside.length === 0 ||
      inside === ".." ||
      inside.startsWith(`..${path.sep}`) ||
      path.isAbsolute(inside)
    )
      throw new Error(`refusing to write outside "${root}": ${relative}`);
    return Object.freeze({
      bytes: Uint8Array.from(Buffer.from(content, "utf8")),
      relative,
      target,
    });
  });
  const ordered = [...entries].sort((left, right) => {
    const leftKey = canonicalScaffoldPath(left.target);
    const rightKey = canonicalScaffoldPath(right.target);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  for (let previousIndex = 0; previousIndex < ordered.length; previousIndex++)
    for (
      let currentIndex = previousIndex + 1;
      currentIndex < ordered.length;
      currentIndex++
    ) {
      const previous = ordered[previousIndex]!;
      const current = ordered[currentIndex]!;
      const previousKey = canonicalScaffoldPath(previous.target);
      const currentKey = canonicalScaffoldPath(current.target);
      if (
        currentKey === previousKey ||
        currentKey.startsWith(`${previousKey}${path.sep}`)
      )
        throw new Error(
          `scaffold paths collide: ${previous.relative}, ${current.relative}`,
        );
    }
  return Object.freeze(entries);
};

/**
 * Publish a precomputed candidate through a receipt-bearing one-file adapter.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Stops at the first non-complete outcome and retains all preceding effects without blind cleanup.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Returns the exact completed prefix and stopping outcome for explicit recovery.
 * @author Samchon
 */
export const publishScaffoldCandidate = (props: {
  candidate: readonly IScaffoldPublicationEntry[];
  publish: (entry: IScaffoldPublicationEntry) => ScaffoldFilePublicationOutcome;
}): IScaffoldPublicationReceipt => {
  const completed: IScaffoldPublicationEntry[] = [];
  for (const entry of props.candidate) {
    const outcome = props.publish(entry);
    if (outcome.status === "completed") {
      if (outcome.parentIdentity.length === 0)
        throw new Error(
          `completed scaffold publication omitted parent identity: ${entry.relative}`,
        );
      completed.push(entry);
      continue;
    }
    if (
      outcome.status === "partial" &&
      (outcome.parentIdentity.length === 0 ||
        Number.isSafeInteger(outcome.bytesWritten) === false ||
        outcome.bytesWritten < 0 ||
        outcome.bytesWritten > entry.bytes.byteLength)
    )
      throw new Error(
        `partial scaffold publication has invalid bound state: ${entry.relative}`,
      );
    return {
      completed: Object.freeze(completed),
      failure: { entry, outcome },
      planned: props.candidate,
      status:
        outcome.status === "refused" && completed.length === 0
          ? "refused"
          : "partial",
    };
  }
  return {
    completed: Object.freeze(completed),
    failure: null,
    planned: props.candidate,
    status: "completed",
  };
};

const canonicalScaffoldPath = (value: string): string => value.toLowerCase();
