import type { AutoMovieAuthoredDocumentLayer } from "@automovie/evidence";
import { type BigIntStats, constants } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  MAX_FILES,
  MAX_SOURCE_BYTES,
  ReferenceError,
  fail,
} from "./internal/referenceError";
import { admitReferencePath, validComponent } from "./internal/referencePath";
import type { IAutoMovieReferenceReader } from "./structures/IAutoMovieReference";

/**
 * The observed identity needed to reject links, substitutions and concurrent writes.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-isolation Distinguishes a physical single-link file from an alias or changed source.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-isolation Carries device, inode, link count and write metadata for pathname and handle comparisons.
 * @author Samchon
 */
export interface IAutoMovieReferenceIdentity {
  kind: "file" | "directory" | "link" | "other";
  device: bigint;
  inode: bigint;
  links: bigint;
  size: bigint;
  modified: bigint;
  changed: bigint;
}

/**
 * Read-only physical operations injected independently of the reference policy.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-isolation Restricts the physical adapter to metadata, enumeration and a bounded read-only handle.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-isolation Makes namespace and handle identity checks exercisable without filesystem fixtures.
 * @author Samchon
 */
export interface IAutoMovieReferenceFileSystem {
  lstat(location: string): Promise<IAutoMovieReferenceIdentity>;
  realpath(location: string): Promise<string>;
  list(location: string): Promise<readonly string[]>;
  open(location: string): Promise<{
    stat(): Promise<IAutoMovieReferenceIdentity>;
    read(maximum: number): Promise<Uint8Array>;
    close(): Promise<void>;
  }>;
}

const identity = (entry: BigIntStats): IAutoMovieReferenceIdentity => ({
  kind: entry.isSymbolicLink()
    ? "link"
    : entry.isDirectory()
      ? "directory"
      : entry.isFile()
        ? "file"
        : "other",
  device: entry.dev,
  inode: entry.ino,
  links: entry.nlink,
  size: entry.size,
  modified: entry.mtimeNs,
  changed: entry.ctimeNs,
});

/**
 * Adapt Node-compatible read primitives to bounded physical source observations.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-isolation Opens source handles read-only and exposes no mutation primitive.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-isolation Maps lstat and handle identities and reads at most one byte beyond the configured ceiling.
 */
export function createAutoMovieReferenceFileSystem(
  native: Pick<typeof fs, "lstat" | "realpath" | "readdir" | "open"> = fs,
): IAutoMovieReferenceFileSystem {
  return {
    lstat: async (location) =>
      identity(await native.lstat(location, { bigint: true })),
    realpath: native.realpath,
    list: native.readdir,
    open: async (location) => {
      const handle = await native.open(
        location,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      return {
        stat: async () => identity(await handle.stat({ bigint: true })),
        read: async (maximum) => {
          const bytes = Buffer.alloc(maximum + 1);
          let length = 0;
          while (length < bytes.length) {
            const read = await handle.read(
              bytes,
              length,
              bytes.length - length,
              length,
            );
            if (read.bytesRead === 0) break;
            length += read.bytesRead;
          }
          return Buffer.from(bytes.subarray(0, length));
        },
        close: () => handle.close(),
      };
    },
  };
}

const sameNode = (
  a: IAutoMovieReferenceIdentity,
  b: IAutoMovieReferenceIdentity,
): boolean => a.kind === b.kind && a.device === b.device && a.inode === b.inode;
const sameFile = (
  a: IAutoMovieReferenceIdentity,
  b: IAutoMovieReferenceIdentity,
): boolean =>
  sameNode(a, b) &&
  a.size === b.size &&
  a.modified === b.modified &&
  a.changed === b.changed;

function ioFailure(error: unknown): never {
  if (error instanceof ReferenceError) throw error;
  const code =
    error !== null && typeof error === "object" && "code" in error
      ? error.code
      : null;
  if (code === "ENOENT")
    return fail(
      "MISSING_FILE",
      "The requested file or directory does not exist.",
    );
  if (code === "EACCES" || code === "EPERM")
    return fail(
      "PERMISSION_DENIED",
      "The bound production does not permit this read.",
    );
  if (code === "ELOOP" || code === "ENOTDIR")
    return fail(
      "PATH_IDENTITY_CHANGED",
      "The path is linked, replaced or no longer a physical directory.",
    );
  return fail("IO_ERROR", "The physical reference read failed.");
}

/**
 * Bind an absolute production root to a stateless, physically checked Markdown reader.
 *
 * The namespace is checked before opening, before consuming bytes, and after the
 * bounded handle read. A replacement or concurrent write invalidates the result.
 * Node's pathname APIs expose observations, not a kernel-level namespace lock;
 * hostile actors with unrestricted concurrent namespace control remain an OS
 * observation boundary rather than something pure unit tests can certify.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-isolation Binds one physical production root and refuses aliases, links and substitutions before returning source bytes.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Distinguishes an absent layer from file, permission, identity and resource failures.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-isolation Compares ancestor realpaths, lstat identities and bounded read-handle metadata around each read.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Enforces the file, inventory and directory-depth limits without creating source or cache files.
 */
export async function createAutoMovieReferenceReader(
  root: string,
  io: IAutoMovieReferenceFileSystem = createAutoMovieReferenceFileSystem(),
): Promise<IAutoMovieReferenceReader> {
  if (!path.isAbsolute(root) || path.resolve(root) !== root)
    fail(
      "INVALID_ROOT",
      "Bind an absolute, normalized production root at startup.",
    );
  const rootIdentity = await io.lstat(root).catch(ioFailure);
  if (
    rootIdentity.kind !== "directory" ||
    path.relative(root, await io.realpath(root).catch(ioFailure)) !== ""
  )
    fail(
      "PATH_IDENTITY_CHANGED",
      "The production root must be its physical directory identity.",
    );
  const rootPath = path.parse(root).root;
  const rootSegments = path
    .relative(rootPath, root)
    .split(path.sep)
    .filter((part) => part.length > 0);
  const pinned: { location: string; identity: IAutoMovieReferenceIdentity }[] =
    [];
  let ancestor = rootPath;
  for (const segment of ["", ...rootSegments]) {
    ancestor = path.join(ancestor, segment);
    const entry = await io.lstat(ancestor).catch(ioFailure);
    if (
      entry.kind !== "directory" ||
      path.relative(ancestor, await io.realpath(ancestor).catch(ioFailure)) !==
        ""
    )
      fail(
        "PATH_IDENTITY_CHANGED",
        "Root ancestry must contain only physical directories.",
      );
    pinned.push({ location: ancestor, identity: entry });
  }
  if (!sameNode(rootIdentity, pinned[pinned.length - 1].identity))
    fail(
      "PATH_IDENTITY_CHANGED",
      "The production root changed while it was bound.",
    );
  const inspectDirectories = async (
    relative: string,
  ): Promise<typeof pinned> => {
    const chain = [...pinned];
    for (const item of pinned) {
      const current = await io.lstat(item.location);
      if (
        !sameNode(item.identity, current) ||
        path.relative(item.location, await io.realpath(item.location)) !== ""
      )
        fail(
          "PATH_IDENTITY_CHANGED",
          "The bound root ancestry changed; restart after inspecting it.",
        );
    }
    let location = root;
    for (const component of relative
      .split("/")
      .filter((part) => part.length > 0)) {
      location = path.join(location, component);
      const entry = await io.lstat(location);
      if (
        entry.kind !== "directory" ||
        path.relative(location, await io.realpath(location)) !== ""
      )
        fail(
          "PATH_IDENTITY_CHANGED",
          "A reference ancestor is not its physical directory identity.",
        );
      chain.push({ location, identity: entry });
    }
    return chain;
  };
  const recheck = async (chain: typeof pinned): Promise<void> => {
    for (const item of chain)
      if (
        !sameNode(item.identity, await io.lstat(item.location)) ||
        path.relative(item.location, await io.realpath(item.location)) !== ""
      )
        fail(
          "PATH_IDENTITY_CHANGED",
          "A reference ancestor changed while the source was read.",
        );
  };
  const physicalFile = (entry: IAutoMovieReferenceIdentity): void => {
    if (entry.kind !== "file" || entry.links !== 1n)
      fail(
        "PATH_IDENTITY_CHANGED",
        "Reference sources must be regular files with exactly one link.",
      );
    if (entry.size > BigInt(MAX_SOURCE_BYTES))
      fail("RESOURCE_LIMIT", "Source exceeds the 8 MiB file limit.");
  };
  return {
    read: async (file) => {
      admitReferencePath(file);
      try {
        const chain = await inspectDirectories(
          file.slice(0, file.lastIndexOf("/")),
        );
        const location = path.join(root, ...file.split("/"));
        const before = await io.lstat(location);
        physicalFile(before);
        if (path.relative(location, await io.realpath(location)) !== "")
          fail(
            "PATH_IDENTITY_CHANGED",
            "The file does not resolve to its declared identity.",
          );
        const handle = await io.open(location);
        try {
          const opened = await handle.stat();
          physicalFile(opened);
          if (!sameFile(before, opened))
            fail(
              "PATH_IDENTITY_CHANGED",
              "The source changed before its handle was opened.",
            );
          await recheck(chain);
          const bytes = await handle.read(Number(opened.size));
          if (bytes.byteLength > MAX_SOURCE_BYTES)
            fail("RESOURCE_LIMIT", "Source exceeds the 8 MiB file limit.");
          const after = await handle.stat();
          const resident = await io.lstat(location);
          physicalFile(after);
          physicalFile(resident);
          if (
            !sameFile(opened, after) ||
            !sameFile(after, resident) ||
            BigInt(bytes.byteLength) !== after.size ||
            path.relative(location, await io.realpath(location)) !== ""
          )
            fail(
              "PATH_IDENTITY_CHANGED",
              "The source changed during its read; fetch a fresh reference.",
            );
          await recheck(chain);
          return bytes;
        } finally {
          await handle.close();
        }
      } catch (error) {
        return ioFailure(error);
      }
    },
    list: async (layer: AutoMovieAuthoredDocumentLayer) => {
      admitReferencePath(`docs/${layer}/index.md`);
      const files: string[] = [];
      const walk = async (relative: string, depth: number): Promise<void> => {
        if (depth > 32)
          fail("RESOURCE_LIMIT", "Layer exceeds the 32-level directory limit.");
        const chain = await inspectDirectories(relative);
        const location = path.join(root, ...relative.split("/"));
        for (const name of await io.list(location)) {
          if (name.startsWith(".")) continue;
          if (!validComponent(name))
            fail(
              "INVALID_PATH",
              "Layer contains a noncanonical file or directory name.",
            );
          const file = `${relative}/${name}`;
          const entry = await io.lstat(path.join(location, name));
          if (entry.kind === "directory") await walk(file, depth + 1);
          else {
            if (entry.kind !== "file" || entry.links !== 1n)
              fail(
                "PATH_IDENTITY_CHANGED",
                "Layer contains a linked or special entry.",
              );
            if (name.endsWith(".md")) {
              files.push(file);
              if (files.length > MAX_FILES)
                fail("RESOURCE_LIMIT", "Layer exceeds the 10,000 file limit.");
            }
          }
        }
        await recheck(chain);
      };
      try {
        // Only absence of the requested population root means an empty layer.
        try {
          await inspectDirectories(`docs/${layer}`);
        } catch (error) {
          if (
            error !== null &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT"
          ) {
            await recheck(pinned);
            return [];
          }
          throw error;
        }
        await walk(`docs/${layer}`, 0);
        return files;
      } catch (error) {
        return ioFailure(error);
      }
    },
  };
}
