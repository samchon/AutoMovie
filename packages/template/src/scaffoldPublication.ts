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
  bytes: readonly number[];
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
 * Complete, read-back-verified publication in the captured parent.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Identifies one exact completed result and its physical owner.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Supplies the verified result generation eligible for reuse.
 * @author Samchon
 */
export interface IScaffoldCompletedFilePublicationOutcome {
  /**
   * Captured physical parent generation used by the native operation.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Identifies the physical owner of the completed result.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Proves completion occurred in the generation selected for reuse.
   */
  parentIdentity: string;
  /**
   * Complete outcome discriminator.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Separates a verified complete result from every unfinished state.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Permits reuse only for the completed arm.
   */
  status: "completed";
}

/**
 * Refusal before a final slot was created.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Records confirmed absence separately from any partial side effect.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Prevents a zero-publication refusal from being adopted as output.
 * @author Samchon
 */
export interface IScaffoldRefusedFilePublicationOutcome {
  /**
   * Exact native or validation cause retained for the caller.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Retains why publication stopped before producing an effect.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Distinguishes refusal from a result eligible for adoption.
   */
  error: unknown;
  /**
   * Native decision that proves no final slot was created.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Identifies the zero-effect boundary without inferring it from a mutable pathname.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Keeps recovery from treating a pre-create refusal as an adoptable result.
   */
  reason: "create-failed" | "parent-changed" | "target-competitor";
  /**
   * Zero-publication outcome discriminator.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Makes confirmed absence explicit in reconciliation.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Excludes the target from partial-result adoption.
   */
  status: "refused";
}

/**
 * A final slot that exists in the captured parent but is not complete.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Records the exact bound partial side effect requiring reconciliation.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Supplies the partial result that may be adopted or abandoned explicitly.
 * @author Samchon
 */
export interface IScaffoldPartialFilePublicationOutcome {
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
  /**
   * Bound partial outcome discriminator.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Separates an observed partial side effect from absence and completion.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Selects the result class requiring an explicit adoption decision.
   */
  status: "partial";
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
  | IScaffoldCompletedFilePublicationOutcome
  | IScaffoldRefusedFilePublicationOutcome
  | IScaffoldPartialFilePublicationOutcome;

/**
 * One completed candidate entry paired with the physical parent generation
 * that received it.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Keeps a completed side effect attached to the generation that actually owns it.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Gives adoption the exact completed target and physical owner.
 * @author Samchon
 */
export interface IScaffoldCompletedPublication {
  /**
   * Candidate entry whose exact bytes passed final readback.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Retains the verified logical result beside its physical owner.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Supplies the exact completed candidate identity for reuse.
   */
  entry: IScaffoldPublicationEntry;
  /**
   * Captured physical parent generation containing the completed entry.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Prevents a completed result from being attributed to a successor pathname.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Binds adoption to the generation that produced the verified result.
   */
  parentIdentity: string;
}

/**
 * The first candidate entry that did not complete and its observed result.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Preserves the exact stopping point and failure class for reconciliation.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Gives recovery one explicit unfinished entry and outcome.
 * @author Samchon
 */
export interface IScaffoldPublicationFailure {
  /**
   * Candidate entry where publication stopped.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Names the original side effect identity requiring reconciliation.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Carries the target considered for recovery.
   */
  entry: IScaffoldPublicationEntry;
  /**
   * Zero-publication or bound-partial result observed at that entry.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Separates absence from a partial side effect before recovery.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Provides the exact effect class recovery may adopt or abandon.
   */
  outcome: Exclude<ScaffoldFilePublicationOutcome, { status: "completed" }>;
}

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
  completed: readonly IScaffoldCompletedPublication[];
  /**
   * Stopping entry and its exact one-file outcome, or `null` on success.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Couples the first unfinished target to its observed effect class.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Makes the recovery input explicit and generation-aware.
   */
  failure: IScaffoldPublicationFailure | null;
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
      bytes: Object.freeze(Array.from(Buffer.from(content, "utf8"))),
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
  const planned = Object.freeze(
    props.candidate.map((entry) =>
      Object.freeze({
        bytes: Object.freeze([...entry.bytes]),
        relative: entry.relative,
        target: entry.target,
      }),
    ),
  );
  const completed: IScaffoldCompletedPublication[] = [];
  for (const entry of planned) {
    const outcome = props.publish(entry);
    if (outcome.status === "completed") {
      if (outcome.parentIdentity.length === 0)
        throw new Error(
          `completed scaffold publication omitted parent identity: ${entry.relative}`,
        );
      completed.push(
        Object.freeze({ entry, parentIdentity: outcome.parentIdentity }),
      );
      continue;
    }
    if (
      outcome.status === "refused" &&
      outcome.reason !== "create-failed" &&
      outcome.reason !== "parent-changed" &&
      outcome.reason !== "target-competitor"
    )
      throw new Error(
        `refused scaffold publication has invalid reason: ${entry.relative}`,
      );
    if (
      outcome.status === "partial" &&
      (outcome.parentIdentity.length === 0 ||
        Number.isSafeInteger(outcome.bytesWritten) === false ||
        outcome.bytesWritten < 0 ||
        outcome.bytesWritten > entry.bytes.length)
    )
      throw new Error(
        `partial scaffold publication has invalid bound state: ${entry.relative}`,
      );
    return Object.freeze({
      completed: Object.freeze(completed),
      failure: Object.freeze({ entry, outcome: Object.freeze({ ...outcome }) }),
      planned,
      status:
        outcome.status === "refused" && completed.length === 0
          ? "refused"
          : "partial",
    });
  }
  return Object.freeze({
    completed: Object.freeze(completed),
    failure: null,
    planned,
    status: "completed",
  });
};

const canonicalScaffoldPath = (value: string): string => value.toLowerCase();
