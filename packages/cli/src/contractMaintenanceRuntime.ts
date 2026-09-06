import {
  type IScaffoldPhysicalDirectory,
  assertScaffoldPhysicalDirectory,
  ensureScaffoldFileDirectory,
  writeScaffoldFile,
} from "@automovie/template";
import { createHash } from "node:crypto";
import * as path from "node:path";
import typia from "typia";

import {
  type IAutoMovieMaintenanceObservation,
  autoMovieMaintenanceFileFromSnapshot,
  observeAutoMovieMaintenanceFiles,
} from "./contractMaintenanceFileSystem";
import {
  renameAutoMovieMaintenanceFile,
  syncAutoMovieMaintenanceDirectory,
  syncAutoMovieMaintenanceFile,
} from "./contractMaintenanceNative";
import type {
  IAutoMovieMaintenanceFile,
  IAutoMovieMaintenanceJournal,
  IAutoMovieMaintenanceTransactionIO,
} from "./contractMaintenanceTransaction";

/**
 * Exclusive active-attempt marker checked before contract and TOC planning.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Makes an interrupted attempt discoverable before another maintenance operation can change its recovery surface.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Gives publication and pending-state readers one canonical marker path.
 */
export const AUTO_MOVIE_MAINTENANCE_PENDING_PATH =
  "automovie/contract-maintenance.pending.json";

interface IPending {
  protocol: "automovie.contract-maintenance.v1";
  id: string;
  kind: IAutoMovieMaintenanceJournal["kind"];
  rootIdentity: string;
  journalDigest: string;
}

const renderPending = (journal: IAutoMovieMaintenanceJournal): string => {
  const pending: IPending = {
    protocol: journal.protocol,
    id: journal.id,
    kind: journal.kind,
    rootIdentity: journal.rootIdentity,
    journalDigest: createHash("sha256")
      .update(`${JSON.stringify(journal, null, 2)}\n`)
      .digest("hex"),
  };
  return `${JSON.stringify(pending, null, 2)}\n`;
};

/**
 * Injectable physical operations of the maintenance adapter, preserving the
 * production signatures while pure tests schedule read, stage and move faults.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Makes physical generation failures explicit at the adapter boundary.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Supplies the directory, exclusive-stage and native-move capabilities consumed by durable publication.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceRuntimeIO {
  /** Revalidate an observed ordinary directory. */
  assertDirectory: typeof assertScaffoldPhysicalDirectory;
  /** Observe exact source bytes and ordinary physical ancestors. */
  observe: typeof observeAutoMovieMaintenanceFiles;
  /** Capture or create a confined destination parent. */
  ensureDirectory: typeof ensureScaffoldFileDirectory;
  /** Exclusively stage one complete file. */
  write: typeof writeScaffoldFile;
  /** Move one exact source into an exclusive held-parent slot. */
  rename: typeof renameAutoMovieMaintenanceFile;
  /** Flush the captured physical directory generation. */
  sync: typeof syncAutoMovieMaintenanceDirectory;
  /** Flush a reused immutable record through its held physical parent. */
  syncFile: typeof syncAutoMovieMaintenanceFile;
}

const runtimeIO: IAutoMovieMaintenanceRuntimeIO = {
  assertDirectory: assertScaffoldPhysicalDirectory,
  observe: observeAutoMovieMaintenanceFiles,
  ensureDirectory: ensureScaffoldFileDirectory,
  write: writeScaffoldFile,
  rename: renameAutoMovieMaintenanceFile,
  sync: syncAutoMovieMaintenanceDirectory,
  syncFile: syncAutoMovieMaintenanceFile,
};

const namespace = (
  id: string,
  kind: IAutoMovieMaintenanceJournal["kind"],
): string => {
  if (!/^[a-f0-9]{64}$/u.test(id))
    throw new Error("Maintenance transaction identity is invalid.");
  return kind === "reference-clients"
    ? `automovie/reference-client-maintenance/${id}`
    : `automovie/contract-migrations/${id}`;
};

const pendingPath = (kind: IAutoMovieMaintenanceJournal["kind"]): string =>
  kind === "reference-clients"
    ? "automovie/reference-client-maintenance.pending.json"
    : AUTO_MOVIE_MAINTENANCE_PENDING_PATH;

/**
 * Load the exact pending journal through the same physical reader used by
 * planning. Shape validation belongs to the native typed JSON parser; the
 * operation then checks the marker's identity against its immutable journal.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Retains and exposes the exact interrupted attempt before new maintenance starts.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Resolves the canonical pending marker to one immutable generation without accepting an unrelated journal.
 */
export const readAutoMoviePendingMaintenance = (
  io: IAutoMovieMaintenanceTransactionIO,
  kind: IAutoMovieMaintenanceJournal["kind"] = "contracts",
): IAutoMovieMaintenanceJournal | null => {
  const resident = io.read(pendingPath(kind));
  if (resident === null) return null;
  const pending = typia.json.assertParse<IPending>(resident.source);
  if (pendingPath(pending.kind) !== pendingPath(kind))
    throw new Error(
      "Maintenance pending marker belongs to another operation namespace.",
    );
  const archived = io.read(
    `${namespace(pending.id, pending.kind)}/transaction.json`,
  );
  if (archived === null)
    throw new Error("Pending maintenance journal is missing.");
  const journal = typia.json.assertParse<IAutoMovieMaintenanceJournal>(
    archived.source,
  );
  if (
    createHash("sha256").update(archived.source).digest("hex") !==
    pending.journalDigest
  )
    throw new Error(
      "Pending maintenance journal bytes differ from their durable marker.",
    );
  if (
    journal.id !== pending.id ||
    journal.kind !== pending.kind ||
    journal.rootIdentity !== pending.rootIdentity
  )
    throw new Error(
      "Pending maintenance journal identity differs from its marker.",
    );
  return journal;
};

/**
 * Connect the durable transaction to physically confined filesystem reads,
 * exclusive native staging, and preserving parent-relative native moves.
 * Every changed directory remains in the captured generation cache until
 * the attempt finishes. No resident file is truncated or pathname-unlinked.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Retains original bytes and pending recovery records while binding every mutation to captured physical parents.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Implements synced immutable preparation, preserving displacement and exclusive activation, receipt publication and pending-marker retirement.
 */
export const createAutoMovieMaintenanceTransactionIO = (
  observation: IAutoMovieMaintenanceObservation,
  kind: IAutoMovieMaintenanceJournal["kind"] = "contracts",
  physical: IAutoMovieMaintenanceRuntimeIO = runtimeIO,
): IAutoMovieMaintenanceTransactionIO => {
  const root = observation.root;
  const directories = new Map(
    observation.directories.map((directory) => [directory.path, directory]),
  );
  const assertRoot = (identity: string): void => {
    if (identity !== root.identity)
      throw new Error(
        "Maintenance journal belongs to another physical project root.",
      );
    for (const directory of directories.values())
      physical.assertDirectory(directory);
  };
  const resolve = (relative: string): string => {
    const absolute = path.resolve(root.path, ...relative.split("/"));
    if (
      relative.includes("\\") ||
      relative.includes("\0") ||
      relative.includes(":") ||
      relative.split("/").some((segment) => ["", ".", ".."].includes(segment))
    )
      throw new Error(
        `Maintenance path escapes its physical root: ${relative}.`,
      );
    return absolute;
  };
  const read = (relative: string): IAutoMovieMaintenanceFile | null => {
    assertRoot(root.identity);
    resolve(relative);
    const current = physical.observe({
      root,
      paths: [relative],
    });
    for (const directory of current.directories) {
      const previous = directories.get(directory.path);
      if (previous !== undefined && previous.identity !== directory.identity)
        throw new Error(
          `Maintenance ancestor changed generation: ${relative}.`,
        );
      directories.set(directory.path, directory);
    }
    const file = current.files[relative]!;
    return file === null
      ? null
      : {
          identity: current.descriptors[relative]!.identity,
          version: autoMovieMaintenanceFileFromSnapshot(
            current.descriptors[relative]!,
            current.sources[relative]!,
          ).version,
          source: current.sources[relative]!,
        };
  };
  const parent = (relative: string): IScaffoldPhysicalDirectory => {
    assertRoot(root.identity);
    return physical.ensureDirectory({
      base: root,
      cache: directories,
      directory: path.dirname(resolve(relative)),
    });
  };
  const stage = (
    relative: string,
    source: string,
  ): IAutoMovieMaintenanceFile => {
    const resident = read(relative);
    if (resident !== null) {
      if (resident.source !== source)
        throw new Error(`Maintenance immutable record differs: ${relative}.`);
      physical.syncFile({
        parent: parent(relative),
        name: path.basename(resolve(relative)),
        file: resident,
      });
      return resident;
    }
    const directory = parent(relative);
    const result = physical.write({
      base: root,
      parent: directory,
      target: resolve(relative),
      bytes: Buffer.from(source),
      force: false,
      expected: null,
    });
    if (result.status !== "completed")
      throw new Error(
        `Maintenance immutable stage did not complete: ${relative}.`,
        { cause: result },
      );
    for (const captured of [...directories.values()].reverse())
      physical.sync(captured);
    const published = read(relative);
    if (published === null || published.source !== source)
      throw new Error(
        `Maintenance immutable stage changed after sync: ${relative}.`,
      );
    return published;
  };
  const move = (
    sourcePath: string,
    source: IAutoMovieMaintenanceFile,
    targetPath: string,
    expected: IAutoMovieMaintenanceFile | null,
  ): void => {
    const sourceParent = parent(sourcePath);
    const targetParent = parent(targetPath);
    assertRoot(root.identity);
    physical.rename({
      source: {
        parent: sourceParent,
        name: path.basename(resolve(sourcePath)),
        file: source,
      },
      target: {
        parent: targetParent,
        name: path.basename(resolve(targetPath)),
        file: expected,
      },
    });
    assertRoot(root.identity);
  };
  const io: IAutoMovieMaintenanceTransactionIO = {
    assertRoot,
    read,
    stage,
    record: (relative, source) => {
      stage(relative, source);
    },
    begin: (journal) => {
      if (pendingPath(journal.kind) !== pendingPath(kind))
        throw new Error(
          "Maintenance journal uses another operation namespace.",
        );
      stage(pendingPath(kind), renderPending(journal));
    },
    replace: (target, expected, candidate) => {
      if (expected !== null)
        move(target, expected, `${candidate.path}.displaced`, null);
      move(candidate.path, candidate.file, target, null);
    },
    retire: (target, expected, archivePath) =>
      move(target, expected, archivePath, null),
    finish: (journal, status) => {
      const directory = namespace(journal.id, journal.kind);
      const archived = `${directory}/${status}.pending.json`;
      const pending = read(pendingPath(kind));
      if (pending === null) {
        if (read(archived)?.source !== renderPending(journal))
          throw new Error(
            "Maintenance pending marker disappeared before completion.",
          );
        return;
      }
      if (pending.source !== renderPending(journal))
        throw new Error(
          "Maintenance pending marker belongs to another attempt.",
        );
      move(pendingPath(kind), pending, archived, null);
    },
  };
  return io;
};
