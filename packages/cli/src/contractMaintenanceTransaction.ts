import { createHash } from "node:crypto";

/**
 * Exact observed content and physical generation of one maintenance file.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Retains the predecessor bytes and generation that a plan approved.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Keeps content and physical identity together across publication and recovery.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceFile {
  /** Physical device and file identity. */
  identity: string;
  /** Exact UTF-8 content. */
  source: string;
  /** Descriptor-observed modification generation. */
  version: string;
}

/**
 * One requested mutation and the exact predecessor approved before staging.
 * A null successor retires a source only after receipt publication.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Makes predecessor preservation mandatory for both replacements and rename retirements.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Orders file writes, source retirement and the final baseline separately.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceChange {
  /** Canonical project-relative target. */
  path: string;
  /** Exact approved predecessor, or null for an exclusive creation. */
  before: IAutoMovieMaintenanceFile | null;
  /** Complete successor bytes, or null for retirement. */
  after: string | null;
}

interface IArtifact {
  file: IAutoMovieMaintenanceFile;
  path: string;
}

interface IJournalChange extends IAutoMovieMaintenanceChange {
  predecessor: IArtifact | null;
  successor: IArtifact | null;
}

/**
 * Durable recovery record whose immutable artifacts retain every predecessor
 * byte before any current target changes. Published file identity follows the
 * staged successor, allowing recovery to distinguish it from a competitor.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Preserves complete predecessor and successor files beside the receipt and baseline commit position.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Records the exact archive artifacts needed to resume or restore an interrupted attempt.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceJournal {
  /** Protocol of the durable journal. */
  protocol: "automovie.contract-maintenance.v1";
  /** Deterministic transaction namespace. */
  id: string;
  /** Operation permitted to recover this pending attempt. */
  kind: "contracts" | "toc" | "reference-clients";
  /** Captured root identity, retained independently of its mutable path. */
  rootIdentity: string;
  /** Changed baseline activation is the final commit; otherwise use a marker. */
  baselinePath: string | null;
  /** Complete changes with immutable before and after artifacts. */
  changes: readonly IJournalChange[];
  /** Append-only publication records written after target verification. */
  receipts: readonly { path: string; source: string }[];
}

/**
 * Physical transaction capability, with no ambient overwrite authority.
 *
 * `stage` and `record` return only after descriptor sync and readback plus
 * durable directory publication. `replace` preserves an occupied target in
 * `<candidate>.displaced`, then activates the staged file with one exclusive
 * parent-relative rename. The pending journal owns the intervening absence.
 * `retire` preserves the exact source in its transaction namespace. Neither
 * operation may truncate a resident or follow an absolute child pathname.
 * A thrown mutation can have completed, so recovery observes ownership rather
 * than treating the exception as proof that nothing happened.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Requires durable originals and exact predecessor authority at every destructive boundary.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Separates durable staging, preserving displacement, exclusive activation and retirement without claiming multi-file atomic visibility.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceTransactionIO {
  /** Revalidate the held physical root and all relevant ancestors. */
  assertRoot(identity: string): void;
  /** Read one physically confined single-link file, or its absence. */
  read(path: string): IAutoMovieMaintenanceFile | null;
  /** Create and durably verify an immutable candidate without overwriting. */
  stage(path: string, source: string): IAutoMovieMaintenanceFile;
  /** Create an immutable exact record, or verify its identical resident. */
  record(path: string, source: string): void;
  /** Publish the pending journal exclusively; reject any different attempt. */
  begin(journal: IAutoMovieMaintenanceJournal): void;
  /** Preserve expected in `<candidate>.displaced`, then activate exclusively. */
  replace(
    path: string,
    expected: IAutoMovieMaintenanceFile | null,
    candidate: IArtifact,
  ): void;
  /** Move the expected source to a retained transaction archive. */
  retire(
    path: string,
    expected: IAutoMovieMaintenanceFile,
    archivePath: string,
  ): void;
  /** Archive the pending marker after committed or restored state is verified. */
  finish(
    journal: IAutoMovieMaintenanceJournal,
    status: "committed" | "restored",
  ): void;
}

/**
 * Observable transaction result, retaining the original error and any path
 * whose competitor prevents safe recovery.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Keeps incomplete attempts distinct from a completed baseline commit.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Names explicit recovery-required state instead of overwriting an unowned generation during rollback.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceResult {
  /** Completed commit, complete predecessor restoration, or retained pending attempt. */
  status: "completed" | "rolled-back" | "recovery-required";
  /** Original publication or recovery failure, if any. */
  error: unknown;
  /** Recovery failures preserve their exact path and cause. */
  recoveryErrors: readonly { path: string; error: unknown }[];
}

const same = (
  left: IAutoMovieMaintenanceFile | null,
  right: IAutoMovieMaintenanceFile | null,
): boolean =>
  left === null || right === null
    ? left === right
    : left.identity === right.identity &&
      left.source === right.source &&
      left.version === right.version;

const owns = (
  current: IAutoMovieMaintenanceFile | null,
  artifact: IArtifact | null,
): boolean =>
  current === null || artifact === null
    ? current === artifact
    : current.identity === artifact.file.identity &&
      current.source === artifact.file.source &&
      current.version === artifact.file.version;

const requireBefore = (
  change: IAutoMovieMaintenanceChange,
  io: IAutoMovieMaintenanceTransactionIO,
): void => {
  if (!same(io.read(change.path), change.before))
    throw new Error(`Maintenance predecessor changed: ${change.path}.`);
};

const journalRoot = (
  journal: Pick<IAutoMovieMaintenanceJournal, "id" | "kind">,
): string =>
  journal.kind === "reference-clients"
    ? `automovie/reference-client-maintenance/${journal.id}`
    : `automovie/contract-migrations/${journal.id}`;

const displaced = (
  change: IJournalChange,
  io: IAutoMovieMaintenanceTransactionIO,
): boolean =>
  [change.successor, change.predecessor].some((artifact) => {
    if (artifact === null) return false;
    const resident = io.read(`${artifact.path}.displaced`);
    return (
      (change.before !== null &&
        resident !== null &&
        resident.identity === change.before.identity &&
        resident.source === change.before.source &&
        resident.version === change.before.version) ||
      (owns(resident, change.successor) && resident !== null)
    );
  });

/**
 * Stage complete predecessor and successor artifacts, then publish the
 * immutable journal and exclusive pending marker before changing any target.
 * The caller supplies its existing validated logical plan; this function
 * closes its physical generation without rebuilding that plan from residents.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Copies every original byte into durable recovery artifacts before granting target mutation.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Publishes a complete immutable preparation record and pending marker before the first replacement.
 */
export const prepareAutoMovieMaintenanceTransaction = (props: {
  kind: IAutoMovieMaintenanceJournal["kind"];
  rootIdentity: string;
  baselinePath: string | null;
  changes: readonly IAutoMovieMaintenanceChange[];
  receipts: readonly { path: string; source: string }[];
  io: IAutoMovieMaintenanceTransactionIO;
}): IAutoMovieMaintenanceJournal => {
  const { io, kind, rootIdentity, baselinePath } = props;
  const receipts = Object.freeze(
    props.receipts.map((receipt) => Object.freeze({ ...receipt })),
  );
  const changes = props.changes
    .map((change) =>
      Object.freeze({
        path: change.path,
        before:
          change.before === null ? null : Object.freeze({ ...change.before }),
        after: change.after,
      }),
    )
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
  if (new Set(changes.map((change) => change.path)).size !== changes.length)
    throw new Error("Maintenance transaction has duplicate target paths.");
  if (changes.some((change) => change.before === null && change.after === null))
    throw new Error("Maintenance transaction cannot retire an absent source.");
  if (
    baselinePath !== null &&
    !changes.some(
      (change) => change.path === baselinePath && change.after !== null,
    )
  )
    throw new Error("Maintenance transaction omitted its successor baseline.");
  io.assertRoot(rootIdentity);
  for (const change of changes) requireBefore(change, io);
  const id = createHash("sha256")
    .update(
      JSON.stringify({
        kind,
        rootIdentity,
        baselinePath,
        changes,
        receipts,
      }),
    )
    .digest("hex");
  const directory = journalRoot({ id, kind });
  const staged = changes.map((change, index): IJournalChange => {
    const stage = (role: string, source: string): IArtifact => {
      const target = `${directory}/${index}.${role}`;
      const file = io.stage(target, source);
      if (file.source !== source)
        throw new Error(`Maintenance archive bytes differ: ${target}.`);
      return Object.freeze({ path: target, file: Object.freeze({ ...file }) });
    };
    return Object.freeze({
      ...change,
      predecessor:
        change.before === null ? null : stage("before", change.before.source),
      successor:
        change.after === null
          ? null
          : change.before?.source === change.after
            ? Object.freeze({ path: change.path, file: change.before })
            : stage("after", change.after),
    });
  });
  const journal: IAutoMovieMaintenanceJournal = Object.freeze({
    protocol: "automovie.contract-maintenance.v1",
    id,
    kind,
    rootIdentity,
    baselinePath,
    changes: Object.freeze(staged),
    receipts,
  });
  for (const change of changes) requireBefore(change, io);
  io.assertRoot(journal.rootIdentity);
  io.record(
    `${directory}/transaction.json`,
    `${JSON.stringify(journal, null, 2)}\n`,
  );
  io.begin(journal);
  return journal;
};

const verifySuccessors = (
  journal: IAutoMovieMaintenanceJournal,
  io: IAutoMovieMaintenanceTransactionIO,
  includeRetirements: boolean,
): void => {
  io.assertRoot(journal.rootIdentity);
  for (const change of journal.changes) {
    if (change.path === journal.baselinePath) continue;
    if (change.after === null && !includeRetirements) continue;
    if (!owns(io.read(change.path), change.successor))
      throw new Error(`Maintenance successor changed: ${change.path}.`);
  }
};

/**
 * Restore an interrupted attempt only where the current path is still owned
 * by this transaction. A committed baseline completes the attempt instead;
 * a competing generation leaves the journal and all archives available for
 * adjudication. No rollback overwrites an unrelated resident.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Recovers exact predecessor content while retaining competitors and the original publication failure.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Uses staged physical identity to distinguish resumable transaction effects from unowned edits and commits the baseline last.
 */
export const recoverAutoMovieMaintenanceTransaction = (props: {
  journal: IAutoMovieMaintenanceJournal;
  io: IAutoMovieMaintenanceTransactionIO;
  error?: unknown;
}): IAutoMovieMaintenanceResult => {
  const { journal, io } = props;
  const recoveryErrors: { path: string; error: unknown }[] = [];
  try {
    io.assertRoot(journal.rootIdentity);
    const baseline = journal.changes.find(
      (change) => change.path === journal.baselinePath,
    );
    const committed =
      baseline === undefined || baseline.before?.source === baseline.after
        ? io.read(`${journalRoot(journal)}/committed.json`)?.source ===
          `${journal.id}\n`
        : owns(io.read(baseline.path), baseline.successor);
    if (committed) {
      if (
        baseline !== undefined &&
        !owns(io.read(baseline.path), baseline.successor)
      )
        throw new Error("Maintenance committed baseline changed generation.");
      verifySuccessors(journal, io, true);
      for (const receipt of journal.receipts)
        io.record(receipt.path, receipt.source);
      io.finish(journal, "committed");
      return { status: "completed", error: props.error, recoveryErrors };
    }
    if (
      baseline !== undefined &&
      !(io.read(baseline.path) === null && displaced(baseline, io)) &&
      !owns(io.read(baseline.path), baseline.predecessor)
    )
      requireBefore(baseline, io);
  } catch (error) {
    return {
      status: "recovery-required",
      error: props.error,
      recoveryErrors: [{ path: journal.baselinePath ?? ".", error }],
    };
  }
  for (const change of [...journal.changes].reverse()) {
    try {
      io.assertRoot(journal.rootIdentity);
      const resident = io.read(change.path);
      if (same(resident, change.before) || owns(resident, change.predecessor))
        continue;
      if (
        !owns(resident, change.successor) &&
        !(resident === null && displaced(change, io))
      )
        throw new Error(
          `Maintenance recovery found a competitor: ${change.path}.`,
        );
      if (change.predecessor === null) {
        io.retire(
          change.path,
          resident!,
          `${journalRoot(journal)}/rollback/${change.path}`,
        );
      } else {
        io.replace(change.path, resident, change.predecessor);
      }
    } catch (error) {
      recoveryErrors.push({ path: change.path, error });
    }
  }
  if (recoveryErrors.length === 0)
    try {
      io.assertRoot(journal.rootIdentity);
      for (const change of journal.changes) {
        const resident = io.read(change.path);
        if (
          !same(resident, change.before) &&
          !owns(resident, change.predecessor)
        )
          throw new Error(
            `Maintenance predecessor was not restored: ${change.path}.`,
          );
      }
      io.finish(journal, "restored");
    } catch (error) {
      recoveryErrors.push({ path: ".", error });
    }
  return {
    status: recoveryErrors.length === 0 ? "rolled-back" : "recovery-required",
    error: props.error,
    recoveryErrors,
  };
};

/**
 * Publish prepared successors, verify and persist their receipt, retire
 * renamed sources, and finally commit the baseline. Caught failures run the
 * same ownership-aware recovery used after a process interruption.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Keeps rename originals until successor verification and durable receipt, and advances the baseline only after every earlier effect completes.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Executes the journal's ordered publication and recovery transitions without claiming an atomic multi-file view.
 */
export const publishAutoMovieMaintenanceTransaction = (props: {
  journal: IAutoMovieMaintenanceJournal;
  io: IAutoMovieMaintenanceTransactionIO;
}): IAutoMovieMaintenanceResult => {
  const { journal, io } = props;
  try {
    io.assertRoot(journal.rootIdentity);
    for (const change of journal.changes) requireBefore(change, io);
    for (const change of journal.changes) {
      if (change.path === journal.baselinePath || change.successor === null)
        continue;
      if (change.before?.source === change.after) continue;
      io.assertRoot(journal.rootIdentity);
      requireBefore(change, io);
      io.replace(change.path, change.before, change.successor);
    }
    verifySuccessors(journal, io, false);
    for (const receipt of journal.receipts)
      io.record(receipt.path, receipt.source);
    for (const change of journal.changes) {
      if (change.after !== null) continue;
      io.assertRoot(journal.rootIdentity);
      requireBefore(change, io);
      io.retire(
        change.path,
        change.before!,
        `${journalRoot(journal)}/retired/${change.path}`,
      );
    }
    verifySuccessors(journal, io, true);
    const baseline = journal.changes.find(
      (change) => change.path === journal.baselinePath,
    );
    if (baseline !== undefined) {
      if (baseline.before?.source !== baseline.after) {
        requireBefore(baseline, io);
        io.replace(baseline.path, baseline.before, baseline.successor!);
      }
      if (!owns(io.read(baseline.path), baseline.successor))
        throw new Error(
          "Maintenance baseline did not commit its staged generation.",
        );
    }
    if (baseline === undefined || baseline.before?.source === baseline.after)
      io.record(`${journalRoot(journal)}/committed.json`, `${journal.id}\n`);
    io.assertRoot(journal.rootIdentity);
    io.finish(journal, "committed");
    return { status: "completed", error: undefined, recoveryErrors: [] };
  } catch (error) {
    return recoverAutoMovieMaintenanceTransaction({ journal, io, error });
  }
};
