import type {
  IAutoMovieMaintenanceFile,
  IAutoMovieMaintenanceJournal,
  IAutoMovieMaintenanceTransactionIO,
} from "automovie";

type Event = {
  operation:
    | "root"
    | "read"
    | "stage"
    | "record"
    | "begin"
    | "replace"
    | "displace"
    | "retire"
    | "finish";
  path: string;
  moment: "before" | "after";
};

/** Pure transaction capability with named logical events and no host IO. */
export const createContractMaintenanceHarness = (
  sources: Readonly<Record<string, string>>,
) => {
  let sequence = 0;
  const file = (source: string): IAutoMovieMaintenanceFile => ({
    identity: `file-${++sequence}`,
    source,
    version: `version-${sequence}`,
  });
  const files = new Map(
    Object.entries(sources).map(([path, source]) => [path, file(source)]),
  );
  const events: Event[] = [];
  const state = {
    pending: null as IAutoMovieMaintenanceJournal | null,
    finished: null as "committed" | "restored" | null,
    rootIdentity: "root-1",
    hook: (_event: Event): void => {},
  };
  const event = (
    operation: Event["operation"],
    path: string,
    moment: Event["moment"],
  ): void => {
    const entry = { operation, path, moment };
    events.push(entry);
    state.hook(entry);
  };
  const read = (path: string): IAutoMovieMaintenanceFile | null =>
    files.get(path) ?? null;
  const same = (
    left: IAutoMovieMaintenanceFile | null,
    right: IAutoMovieMaintenanceFile | null,
  ): boolean => JSON.stringify(left) === JSON.stringify(right);
  const exact = (
    path: string,
    expected: IAutoMovieMaintenanceFile | null,
  ): void => {
    if (!same(read(path), expected))
      throw new Error(`competing generation at ${path}`);
  };
  const record = (path: string, source: string): IAutoMovieMaintenanceFile => {
    const resident = read(path);
    if (resident !== null) {
      if (resident.source !== source)
        throw new Error(`immutable record competitor at ${path}`);
      return resident;
    }
    const created = file(source);
    files.set(path, created);
    return created;
  };
  const io: IAutoMovieMaintenanceTransactionIO = {
    assertRoot: (identity) => {
      event("root", ".", "before");
      if (identity !== state.rootIdentity)
        throw new Error("root generation changed");
      event("root", ".", "after");
    },
    read: (path) => {
      event("read", path, "before");
      const current = read(path);
      event("read", path, "after");
      return current;
    },
    stage: (path, source) => {
      event("stage", path, "before");
      const staged = record(path, source);
      event("stage", path, "after");
      return staged;
    },
    record: (path, source) => {
      event("record", path, "before");
      record(path, source);
      event("record", path, "after");
    },
    begin: (journal) => {
      event("begin", journal.id, "before");
      if (state.pending !== null && state.pending.id !== journal.id)
        throw new Error("another transaction is pending");
      state.pending = journal;
      event("begin", journal.id, "after");
    },
    replace: (path, expected, candidate) => {
      event("replace", path, "before");
      exact(path, expected);
      exact(candidate.path, candidate.file);
      if (expected !== null) {
        event("displace", path, "before");
        exact(`${candidate.path}.displaced`, null);
        files.set(`${candidate.path}.displaced`, expected);
        files.delete(path);
        event("displace", path, "after");
      }
      exact(path, null);
      files.set(path, { ...candidate.file });
      files.delete(candidate.path);
      event("replace", path, "after");
    },
    retire: (path, expected, archivePath) => {
      event("retire", path, "before");
      exact(path, expected);
      exact(archivePath, null);
      files.set(archivePath, expected);
      files.delete(path);
      event("retire", path, "after");
    },
    finish: (journal, status) => {
      event("finish", journal.id, "before");
      if (state.pending === null && state.finished === status) return;
      if (state.pending?.id !== journal.id)
        throw new Error("pending ownership changed");
      state.finished = status;
      state.pending = null;
      event("finish", journal.id, "after");
    },
  };
  return { files, events, state, io, file, read };
};

/** A named fault fires once so subsequent recovery has its own outcome. */
export const failContractMaintenanceEvent = (
  harness: ReturnType<typeof createContractMaintenanceHarness>,
  operation: Event["operation"],
  path: string,
  moment: Event["moment"],
): (() => boolean) => {
  let fired = false;
  harness.state.hook = (event) => {
    if (
      !fired &&
      event.operation === operation &&
      event.path === path &&
      event.moment === moment
    ) {
      fired = true;
      throw new Error(`injected ${operation} ${moment} at ${path}`);
    }
  };
  return () => fired;
};

/** Preserve the exact exception from a refused pure operation. */
export const contractMaintenanceFailure = (task: () => unknown): unknown => {
  try {
    task();
    return undefined;
  } catch (error) {
    return error;
  }
};
