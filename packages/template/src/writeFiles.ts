import * as fs from "node:fs";
import * as path from "node:path";

import {
  type IScaffoldPhysicalDirectory,
  assertScaffoldPhysicalDirectory,
  ensureScaffoldBaseDirectory,
  ensureScaffoldFileDirectory,
  writeScaffoldFile,
} from "./scaffoldFileSnapshot";
import {
  type IScaffoldPublicationReceipt,
  planScaffoldPublication,
  publishScaffoldCandidate,
} from "./scaffoldPublication";

/**
 * Error raised by the compatibility write API with its exact publication
 * receipt retained for recovery.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Keeps the completed prefix and stopping effect attached to a failed legacy write call.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Lets a caller inspect the same receipt used by the non-throwing publication API.
 * @author Samchon
 * @internal
 */
export class ScaffoldPublicationError extends Error {
  /**
   * Exact candidate-wide effect observed before the compatibility call threw.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Preserves the completed prefix and stopping effect for reconciliation.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Supplies the immutable receipt to an explicit recovery decision.
   */
  public readonly receipt: IScaffoldPublicationReceipt;

  /**
   * Construct the compatibility error from the already completed receipt.
   *
   * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Raises only after the exact observed effect has been captured.
   * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Keeps the recovery value intact across the legacy throwing boundary.
   */
  public constructor(receipt: IScaffoldPublicationReceipt) {
    const failure = receipt.failure;
    super(
      failure === null
        ? "scaffold publication failed without a stopping entry"
        : `scaffold publication ${receipt.status}: ${JSON.stringify({
            completed: receipt.completed.map(({ entry, parentIdentity }) => ({
              parentIdentity,
              relative: entry.relative,
            })),
            failure: {
              bytesWritten:
                failure.outcome.status === "partial"
                  ? failure.outcome.bytesWritten
                  : undefined,
              parentIdentity:
                failure.outcome.status === "partial"
                  ? failure.outcome.parentIdentity
                  : undefined,
              reason:
                failure.outcome.status === "refused"
                  ? failure.outcome.reason
                  : undefined,
              relative: failure.entry.relative,
              status: failure.outcome.status,
            },
          })}`,
      { cause: failure?.outcome.error },
    );
    this.name = "ScaffoldPublicationError";
    this.receipt = receipt;
  }
}

/**
 * Materialize a `{ relativePath: content }` map under `location`, creating
 * parent directories as needed, and return the absolute paths written
 * (sorted).
 *
 * Refuses lexical escapes, colliding targets, linked physical parents, and
 * pathname successors. New files reserve their final slot directly; `force`
 * modifies only the exact captured ordinary single-link file generation.
 * Rendering the map is {@link renderScaffold}'s job; this is its write half.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Repeated explicit writes converge on the same scaffold bytes while an unforced duplicate is refused.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Binds a retry to the same deterministic file map and verifies each resident result.
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-duplicate-submission Refuses duplicate final paths unless exact replacement is explicitly authorized.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-duplicate-submission Resolves an existing target through explicit refusal or exact replacement.
 * @author Samchon
 *
 * @evidence requirements/operations-and-recovery/README.md#운영과-복구-요구사항 Writes a rendered tree into a directory the user already owns without destroying what is there.
 * @evidence specifications/execution-and-recovery/README.md#실행과-복구-시스템-계약 Implements the write half of scaffold materialization under captured physical identity.
 * @evidenceExclude requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-exactly-once-claim-boundary Materialization has no claim ticket and no delivery attempt; repeated calls converge on the same bytes rather than being deduplicated by an identifier.
 * @evidenceExclude requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-external-side-effect-outcome Every effect is inside the target directory, so no external system observes an outcome this write must classify.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-exactly-once-boundary The scaffold write carries no submission identity, so it defines no exactly-once boundary.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-external-outcome-reconciliation There is no external outcome: the write's entire effect is the local tree it materializes.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-retry-backoff-schedule The caller decides whether to run the command again; this function schedules nothing.
 * @evidenceExclude specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-retry-eligibility-limit A refusal is terminal and named, so no eligibility window or attempt limit applies.
 */
export const writeFiles = (
  location: string,
  files: Record<string, string>,
  options?: { force?: boolean },
): string[] => {
  const receipt = publishFiles(location, files, options);
  if (receipt.status !== "completed")
    throw new ScaffoldPublicationError(receipt);
  // Code-unit order, not localeCompare: a scaffold must lay files down in the
  // same order on every host (localeCompare varies with host locale/ICU).
  return receipt.completed
    .map(({ entry }) => entry.target)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
};

/**
 * Materialize a complete validated file candidate and report its exact
 * completed prefix or stopping effect.
 *
 * Candidate validation finishes before directory creation. Each new file is
 * then published relative to a captured native parent handle; the function
 * stops at the first refusal or partial result and never cleans up through a
 * mutable pathname.
 *
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-idempotent-deterministic-results Closes the complete target and byte candidate before the first filesystem mutation.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-deterministic-result-reuse Publishes one immutable candidate in deterministic entry order.
 * @evidence requirements/operations-and-recovery/idempotency-and-side-effects.md#operations-compensation-reconciliation Returns the completed prefix and exact stopping effect without blind cleanup.
 * @evidence specifications/execution-and-recovery/retry-backoff-and-idempotency.md#execution-compensation-adoption Preserves parent-bound partial state for an explicit caller decision.
 * @author Samchon
 */
export const publishFiles = (
  location: string,
  files: Record<string, string>,
  options?: { force?: boolean },
): IScaffoldPublicationReceipt => {
  const base = path.resolve(process.cwd(), location);
  const candidate = planScaffoldPublication({ files, root: base });
  let baseOwnership: IScaffoldPhysicalDirectory | undefined;
  let directories: Map<string, IScaffoldPhysicalDirectory> | undefined;
  return publishScaffoldCandidate({
    candidate,
    publish: (entry) => {
      try {
        if (baseOwnership === undefined) {
          baseOwnership = ensureScaffoldBaseDirectory(base);
          assertScaffoldPhysicalDirectory(baseOwnership);
          if (fs.readdirSync(base).length > 0 && options?.force !== true)
            throw new Error(
              `target directory is not empty: ${base}; pass --force to scaffold into it anyway`,
            );
          assertScaffoldPhysicalDirectory(baseOwnership);
          directories = new Map([[baseOwnership.path, baseOwnership]]);
        }
        const parent = ensureScaffoldFileDirectory({
          base: baseOwnership,
          cache: directories!,
          directory: path.dirname(entry.target),
        });
        return writeScaffoldFile({
          base: baseOwnership,
          bytes: Uint8Array.from(entry.bytes),
          force: options?.force === true,
          parent,
          target: entry.target,
        });
      } catch (error) {
        return Object.freeze({
          error,
          reason: "create-failed" as const,
          status: "refused" as const,
        });
      }
    },
  });
};
