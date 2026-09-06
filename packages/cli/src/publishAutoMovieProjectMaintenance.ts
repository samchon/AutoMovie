import type { IAutoMovieMaintenanceObservation } from "./contractMaintenanceFileSystem";
import { autoMovieMaintenanceFileFromSnapshot } from "./contractMaintenanceFileSystem";
import {
  type IAutoMovieMaintenanceChange,
  type IAutoMovieMaintenanceJournal,
  type IAutoMovieMaintenanceResult,
  type IAutoMovieMaintenanceTransactionIO,
  prepareAutoMovieMaintenanceTransaction,
  publishAutoMovieMaintenanceTransaction,
  recoverAutoMovieMaintenanceTransaction,
} from "./contractMaintenanceTransaction";

/**
 * Bind planned text to the descriptor generation observed before planning.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Retains the original physical predecessor instead of approving a later resident.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Supplies exact before tokens and bytes to the durable publication protocol.
 */
export const planAutoMoviePhysicalMaintenanceChanges = (
  observation: IAutoMovieMaintenanceObservation,
  successors: Readonly<Record<string, string | null>>,
): IAutoMovieMaintenanceChange[] =>
  Object.entries(successors).map(([relative, after]) => {
    if (!Object.hasOwn(observation.files, relative))
      throw new Error(`Maintenance target was not observed: ${relative}.`);
    const snapshot = observation.files[relative]!;
    const descriptor = observation.descriptors[relative];
    const source = observation.sources[relative];
    if (snapshot === null) {
      if (descriptor !== null || source !== undefined)
        throw new Error(
          `Maintenance absence has inconsistent authority: ${relative}.`,
        );
      return { path: relative, before: null, after };
    }
    if (descriptor == null || source === undefined)
      throw new Error(
        `Maintenance predecessor lacks descriptor bytes: ${relative}.`,
      );
    return {
      path: relative,
      before: autoMovieMaintenanceFileFromSnapshot(descriptor, source),
      after,
    };
  });

/**
 * Resume only the explicitly requested maintenance kind, never during dry-run.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Keeps an interrupted attempt recoverable without silently mixing another operation into it.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Refuses observation-only commands and mismatched pending protocols before recovery effects.
 */
export const recoverAutoMovieProjectMaintenance = (props: {
  pending: IAutoMovieMaintenanceJournal | null;
  kind: IAutoMovieMaintenanceJournal["kind"];
  mutate: boolean;
  io: IAutoMovieMaintenanceTransactionIO;
}): IAutoMovieMaintenanceResult | null => {
  if (props.pending === null) return null;
  if (props.pending.kind !== props.kind)
    throw new Error(
      `Pending ${props.pending.kind} maintenance must be recovered before ${props.kind}.`,
    );
  if (!props.mutate)
    throw new Error(
      `Pending ${props.kind} maintenance requires recovery; observation-only mode made no change.`,
    );
  const result = recoverAutoMovieMaintenanceTransaction({
    journal: props.pending,
    io: props.io,
  });
  if (result.status === "recovery-required") throw maintenanceError(result);
  return result;
};

/**
 * Publish a closed observed candidate and reject a rolled-back request as failure.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Prepares durable predecessors and completes only a verified successor publication.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Keeps preparation, commit, and recovery outcomes distinct at the command boundary.
 */
export const publishAutoMovieProjectMaintenance = (props: {
  observation: IAutoMovieMaintenanceObservation;
  kind: IAutoMovieMaintenanceJournal["kind"];
  successors: Readonly<Record<string, string | null>>;
  baselinePath: string | null;
  receipts: readonly { path: string; source: string }[];
  io: IAutoMovieMaintenanceTransactionIO;
}): IAutoMovieMaintenanceResult => {
  const changes = planAutoMoviePhysicalMaintenanceChanges(
    props.observation,
    props.successors,
  );
  const journal = prepareAutoMovieMaintenanceTransaction({
    kind: props.kind,
    rootIdentity: props.observation.root.identity,
    baselinePath: props.baselinePath,
    changes,
    receipts: props.receipts,
    io: props.io,
  });
  const result = publishAutoMovieMaintenanceTransaction({
    journal,
    io: props.io,
  });
  if (result.status !== "completed") throw maintenanceError(result);
  return result;
};

const maintenanceError = (result: IAutoMovieMaintenanceResult): Error => {
  const reason = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
  return new Error(
    `Maintenance ${result.status}: ${reason(result.error)}${result.recoveryErrors.map((failure) => `; ${failure.path}: ${reason(failure.error)}`).join("")}. Preserve the pending journal, predecessors, candidates, and competing files.`,
    { cause: result },
  );
};
