import { createAutoMovieReferenceFileSystem } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import { constants } from "node:fs";

/**
 * The Node primitive adapter performs read-only bounded I/O through injected calls.
 *
 * Scenarios:
 * 1. Each native entry kind maps to the expected physical identity.
 * 2. Partial reads, EOF and exact overflow consume only the configured buffer.
 * 3. The adapter preserves native failures and closes through the supplied handle.
 */
export const test_reference_node_adapter = async (): Promise<void> => {
  let kind = "file";
  let content = Buffer.from("abc");
  let closed = 0;
  let flags = -1;
  const stats = () => ({
    isSymbolicLink: () => kind === "link",
    isDirectory: () => kind === "directory",
    isFile: () => kind === "file",
    dev: 1n,
    ino: 2n,
    nlink: 1n,
    size: BigInt(content.length),
    mtimeNs: 0n,
    ctimeNs: 0n,
  });
  const native = {
    lstat: async () => stats(),
    realpath: async (location: string) => location,
    readdir: async () => ["a.md"],
    open: async (_location: string, openingFlags: number) => {
      flags = openingFlags;
      return {
        stat: async () => stats(),
        read: async (
          buffer: Buffer,
          offset: number,
          length: number,
          position: number,
        ) => {
          const count = Math.min(1, length, content.length - position);
          if (count > 0)
            content.copy(buffer, offset, position, position + count);
          return { bytesRead: count, buffer };
        },
        close: async () => {
          ++closed;
        },
      };
    },
  };
  const io = createAutoMovieReferenceFileSystem(
    native as unknown as Parameters<
      typeof createAutoMovieReferenceFileSystem
    >[0],
  );
  for (kind of ["file", "directory", "link", "other"])
    TestValidator.equals("native kind", (await io.lstat("ignored")).kind, kind);
  kind = "file";
  TestValidator.equals(
    "native realpath",
    await io.realpath("identity"),
    "identity",
  );
  TestValidator.equals("native directory entries", await io.list("identity"), [
    "a.md",
  ]);
  const handle = await io.open("ignored");
  TestValidator.predicate(
    "read-only flags",
    (flags &
      (constants.O_WRONLY |
        constants.O_RDWR |
        constants.O_CREAT |
        constants.O_TRUNC)) ===
      0,
  );
  TestValidator.equals("handle metadata", (await handle.stat()).size, 3n);
  TestValidator.equals(
    "partial reads assembled",
    await handle.read(4),
    Buffer.from("abc"),
  );
  content = Buffer.from("abcdef");
  TestValidator.equals(
    "one overflow byte only",
    await handle.read(3),
    Buffer.from("abcd"),
  );
  content = Buffer.alloc(0);
  TestValidator.equals("empty EOF", await handle.read(3), Buffer.alloc(0));
  await handle.close();
  TestValidator.equals("native close", closed, 1);
  const failure = new Error("native read denied");
  const failing = createAutoMovieReferenceFileSystem({
    ...native,
    lstat: async () => {
      throw failure;
    },
  } as unknown as Parameters<typeof createAutoMovieReferenceFileSystem>[0]);
  let caught: unknown;
  try {
    await failing.lstat("ignored");
  } catch (error) {
    caught = error;
  }
  TestValidator.predicate(
    "native failure is left for reader classification",
    caught === failure,
  );
};
