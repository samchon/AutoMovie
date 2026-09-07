import type { IScaffoldPhysicalDirectory } from "@automovie/template";
import koffi from "koffi";
import * as fs from "node:fs";

import { createWindowsMaintenanceNativeIO } from "./contractMaintenanceNativeWindows";
import type { IAutoMovieMaintenanceFile } from "./contractMaintenanceTransaction";

/**
 * One captured-parent move, with an exchange retaining the displaced resident
 * in the source slot instead of unlinking it. The caller has already made a
 * durable copy of all original bytes before requesting an exchange.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Retains the displaced physical file during replacement and binds both slots to captured parent generations.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Expresses no-overwrite movement and preserving exchange as different native authorities.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceRenameRequest {
  /** Exact staged or retiring source inside its held parent. */
  source: {
    parent: IScaffoldPhysicalDirectory;
    name: string;
    file: IAutoMovieMaintenanceFile;
  };
  /** Expected resident, or exclusive absence for a new slot. */
  target: {
    parent: IScaffoldPhysicalDirectory;
    name: string;
    file: IAutoMovieMaintenanceFile | null;
  };
}

/**
 * Descriptor-only native operations used by preserving maintenance moves.
 * The injected form exercises failure and competition without an OS fixture.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Holds both physical parents through move, displaced-byte verification and durability.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Provides native no-replace and exchange effects without mutable absolute child paths.
 * @author Samchon
 */
export interface IAutoMovieMaintenanceNativeIO {
  /** Open an ordinary parent without following its leaf. */
  openParent(path: string): number;
  /** Physical identity read from the held ordinary directory descriptor. */
  parentIdentity(descriptor: number): string;
  /** Open and read an ordinary single-link child relative to its held parent. */
  read(parent: number, name: string): IAutoMovieMaintenanceFile | null;
  /** Native atomic exchange when occupied, or atomic no-replace move when absent. */
  rename(
    source: number,
    sourceName: string,
    target: number,
    targetName: string,
    exchange: boolean,
  ): void;
  /** Make the directory entry update durable. */
  sync(parent: number): void;
  /** Flush the data of a held-parent child before relying on an old record. */
  flushFile(parent: number, name: string): void;
  /** Release one native directory descriptor. */
  close(parent: number): void;
}

const exact = (
  left: IAutoMovieMaintenanceFile | null,
  right: IAutoMovieMaintenanceFile | null,
): boolean =>
  left === null || right === null
    ? left === right
    : left.identity === right.identity &&
      left.source === right.source &&
      left.version === right.version;

const requireChildName = (name: string): void => {
  if (!/^[^/\\\0:]+$/u.test(name) || name === "." || name === "..")
    throw new Error(
      "Maintenance native operation requires one ordinary child name.",
    );
};

const nativeFailure = (error: unknown): Error =>
  error instanceof Error
    ? error
    : new Error("Maintenance native operation failed.", { cause: error });

const usingDescriptor = <T>(
  parent: number,
  close: (descriptor: number) => void,
  action: (parent: number) => T,
): T => {
  let failure: Error | undefined;
  let output!: T;
  try {
    output = action(parent);
  } catch (error) {
    failure = nativeFailure(error);
  }
  try {
    close(parent);
  } catch (error) {
    failure =
      failure === undefined
        ? nativeFailure(error)
        : new AggregateError(
            [failure, error],
            "Maintenance operation and parent close failed.",
          );
  }
  if (failure !== undefined) throw failure;
  return output;
};

/**
 * Execute a parent-bound preserving move and inspect both resident slots.
 * A late competitor displaced by an exchange remains in the source archive;
 * the mismatch throws rather than reporting that the planned predecessor was
 * replaced. Every opened parent is closed even when another close fails.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Rejects changed source and target generations and retains every displaced byte in the bound archive slot.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Uses atomic native exchange or no-replace movement and verifies both post-move identities before accepting publication.
 */
export const renameAutoMovieMaintenanceFile = (
  request: IAutoMovieMaintenanceRenameRequest,
  io: IAutoMovieMaintenanceNativeIO = nativeIO(),
): void => {
  for (const slot of [request.source, request.target])
    requireChildName(slot.name);
  const opened: number[] = [];
  let failure: Error | undefined;
  try {
    const source = io.openParent(request.source.parent.path);
    opened.push(source);
    const target = io.openParent(request.target.parent.path);
    opened.push(target);
    if (
      io.parentIdentity(source) !== request.source.parent.identity ||
      io.parentIdentity(target) !== request.target.parent.identity
    )
      throw new Error("Maintenance native move changed its captured parent.");
    if (!exact(io.read(source, request.source.name), request.source.file))
      throw new Error("Maintenance native move source changed after planning.");
    if (!exact(io.read(target, request.target.name), request.target.file))
      throw new Error("Maintenance native move target changed after planning.");
    io.rename(
      source,
      request.source.name,
      target,
      request.target.name,
      request.target.file !== null,
    );
    io.sync(source);
    io.sync(target);
    if (!exact(io.read(target, request.target.name), request.source.file))
      throw new Error("Maintenance native move lost its candidate generation.");
    if (!exact(io.read(source, request.source.name), request.target.file))
      throw new Error(
        "Maintenance native exchange retained a competing generation in its archive.",
      );
  } catch (error) {
    failure = nativeFailure(error);
  }
  for (const descriptor of opened.reverse())
    try {
      io.close(descriptor);
    } catch (error) {
      failure =
        failure === undefined
          ? nativeFailure(error)
          : new AggregateError(
              [failure, error],
              "Maintenance native move and close failed.",
            );
    }
  if (failure !== undefined) throw failure;
};

/**
 * Flush one captured parent after publishing an immutable record or creating
 * a child directory, so a synced child is not mistaken for a durable name.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Makes recovery record names durable before a current target may change.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Flushes the held directory generation that owns each immutable archive entry.
 */
export const syncAutoMovieMaintenanceDirectory = (
  directory: IScaffoldPhysicalDirectory,
  io: IAutoMovieMaintenanceNativeIO = nativeIO(),
): void => {
  usingDescriptor(io.openParent(directory.path), io.close, (descriptor) => {
    if (io.parentIdentity(descriptor) !== directory.identity)
      throw new Error("Maintenance sync parent changed generation.");
    io.sync(descriptor);
  });
};

/**
 * Reconfirm durability when interrupted preparation left a complete record
 * whose earlier flush may not have finished.
 *
 * @evidence requirements/operations-and-recovery/contract-migration-publication.md#operations-contract-migration-publication Flushes reused immutable recovery bytes before allowing them to protect a later replacement.
 * @evidence specifications/execution-and-recovery/contract-migration-publication.md#execution-contract-migration-publication Verifies and flushes one existing record through its captured physical parent.
 */
export const syncAutoMovieMaintenanceFile = (
  props: IAutoMovieMaintenanceRenameRequest["source"],
  io: IAutoMovieMaintenanceNativeIO = nativeIO(),
): void => {
  requireChildName(props.name);
  usingDescriptor(io.openParent(props.parent.path), io.close, (parent) => {
    if (
      io.parentIdentity(parent) !== props.parent.identity ||
      !exact(io.read(parent, props.name), props.file)
    )
      throw new Error(
        "Maintenance reused record changed its physical generation.",
      );
    io.flushFile(parent, props.name);
    io.sync(parent);
    if (!exact(io.read(parent, props.name), props.file))
      throw new Error("Maintenance reused record changed during flush.");
  });
};

interface IPosixBindings {
  openat(parent: number, name: string, flags: number, mode: number): number;
  rename(
    source: number,
    sourceName: string,
    target: number,
    targetName: string,
    flags: number,
  ): number;
}

interface INativeEnvironment {
  platform: NodeJS.Platform;
  fileSystem: typeof fs;
  foreign: typeof koffi;
  windows(): IAutoMovieMaintenanceNativeIO;
}

const environment: INativeEnvironment = {
  platform: process.platform,
  fileSystem: fs,
  foreign: koffi,
  windows: createWindowsMaintenanceNativeIO,
};

const nativeIO = (
  input: INativeEnvironment = environment,
): IAutoMovieMaintenanceNativeIO => {
  const { platform, fileSystem, foreign } = input;
  if (platform === "win32") return input.windows();
  if (platform !== "linux" && platform !== "darwin")
    throw new Error(
      `Maintenance preserving native movement is unavailable on ${platform}; predecessor files were not changed.`,
    );
  const darwin = platform === "darwin";
  const libraryHandle = foreign.load(null);
  const library: IPosixBindings = {
    openat: libraryHandle.func(
      "int openat(int parent, const char *name, int flags, uint32_t mode)",
    ) as IPosixBindings["openat"],
    rename: libraryHandle.func(
      `int ${darwin ? "renameatx_np" : "renameat2"}(int source, const char *sourceName, int target, const char *targetName, uint32_t flags)`,
    ) as IPosixBindings["rename"],
  };
  const check = (result: number, operation: string): number => {
    if (result < 0)
      throw new Error(
        `${operation} failed with native errno ${foreign.errno()}.`,
      );
    return result;
  };
  const identity = (status: fs.BigIntStats): string =>
    `${status.dev}:${status.ino}`;
  return {
    openParent: (target) =>
      fileSystem.openSync(
        target,
        fileSystem.constants.O_RDONLY |
          fileSystem.constants.O_DIRECTORY |
          fileSystem.constants.O_NOFOLLOW,
      ),
    parentIdentity: (descriptor) => {
      const status = fileSystem.fstatSync(descriptor, { bigint: true });
      if (!status.isDirectory())
        throw new Error(
          "Maintenance parent descriptor is not an ordinary directory.",
        );
      return identity(status);
    },
    read: (parent, name) => {
      const descriptor = library.openat(
        parent,
        name,
        fileSystem.constants.O_RDONLY | fileSystem.constants.O_NOFOLLOW,
        0,
      );
      if (descriptor < 0 && foreign.errno() === foreign.os.errno.ENOENT)
        return null;
      check(descriptor, "Maintenance child open");
      return usingDescriptor(descriptor, fileSystem.closeSync, () => {
        const before = fileSystem.fstatSync(descriptor, { bigint: true });
        if (!before.isFile() || before.nlink !== 1n)
          throw new Error(
            "Maintenance child is not one ordinary single-link file.",
          );
        const source = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(fileSystem.readFileSync(descriptor));
        const after = fileSystem.fstatSync(descriptor, { bigint: true });
        const version = (status: fs.BigIntStats): string =>
          `${identity(status)}:${status.size}:${status.mtimeNs}`;
        if (
          !after.isFile() ||
          after.nlink !== 1n ||
          version(before) !== version(after)
        )
          throw new Error("Maintenance child changed during native read.");
        return { identity: identity(after), source, version: version(after) };
      });
    },
    rename: (source, sourceName, target, targetName, exchange) => {
      check(
        library.rename(
          source,
          sourceName,
          target,
          targetName,
          exchange ? 2 : darwin ? 4 : 1,
        ),
        "Maintenance native rename",
      );
    },
    sync: fileSystem.fsyncSync,
    flushFile: (parent, name) => {
      const descriptor = check(
        library.openat(
          parent,
          name,
          fileSystem.constants.O_RDONLY | fileSystem.constants.O_NOFOLLOW,
          0,
        ),
        "Maintenance record open",
      );
      usingDescriptor(descriptor, fileSystem.closeSync, () => {
        fileSystem.fsyncSync(descriptor);
      });
    },
    close: fileSystem.closeSync,
  };
};

/**
 * Injectable native dispatch for pure platform-boundary scenarios.
 * Keeps platform refusal and descriptor effects observable without OS fixtures.
 * @internal
 */
export const contractMaintenanceNativeForTesting = { create: nativeIO };
