import type {
  IAutoMovieReferenceFileSystem,
  IAutoMovieReferenceIdentity,
} from "@automovie/mcp";
import * as path from "node:path";

/**
 * Supplies physical-read observations from memory without opening an OS path.
 * Each hook changes only the next injected observation, so a test can distinguish
 * namespace replacement from handle mutation without reproducing filesystem rules.
 */
export function createReferenceMemoryFileSystem() {
  const root = path.resolve(
    path.parse(process.cwd()).root,
    "reference-test-production",
  );
  const file = "docs/settings/a.md";
  const absolute = path.join(root, ...file.split("/"));
  const directory: IAutoMovieReferenceIdentity = {
    kind: "directory",
    device: 1n,
    inode: 1n,
    links: 2n,
    size: 0n,
    modified: 0n,
    changed: 0n,
  };
  const bytes = Buffer.from("## A {#a}\nbody");
  const regular: IAutoMovieReferenceIdentity = {
    ...directory,
    kind: "file",
    inode: 2n,
    links: 1n,
    size: BigInt(bytes.length),
  };
  const entries = new Map<string, IAutoMovieReferenceIdentity>();
  let cursor = root;
  while (true) {
    entries.set(cursor, { ...directory });
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  entries.set(path.join(root, "docs"), { ...directory, inode: 3n });
  entries.set(path.join(root, "docs/settings"), { ...directory, inode: 4n });
  entries.set(absolute, { ...regular });
  const state = {
    bytes: bytes as Uint8Array,
    handle: { ...regular },
    entries,
    aliases: new Map<string, string>(),
    listings: new Map<string, string[]>([
      [path.join(root, "docs/settings"), ["a.md"]],
    ]),
    trace: [] as { operation: string; location: string }[],
    hook: (_operation: string, _location: string): void => undefined,
  };
  const observe = (operation: string, location: string): void => {
    state.trace.push({ operation, location });
    state.hook(operation, location);
  };
  const io: IAutoMovieReferenceFileSystem = {
    lstat: async (location) => {
      observe("lstat", location);
      const entry = entries.get(location);
      if (entry === undefined)
        throw Object.assign(new Error("missing injected entry"), {
          code: "ENOENT",
        });
      return { ...entry };
    },
    realpath: async (location) => {
      observe("realpath", location);
      return state.aliases.get(location) ?? location;
    },
    list: async (location) => {
      observe("list", location);
      return state.listings.get(location) ?? [];
    },
    open: async (location) => {
      observe("open", location);
      return {
        stat: async () => {
          observe("stat", location);
          return { ...state.handle };
        },
        read: async () => {
          observe("read", location);
          return state.bytes;
        },
        close: async () => {
          observe("close", location);
        },
      };
    },
  };
  return { root, file, absolute, state, io, directory, regular };
}
