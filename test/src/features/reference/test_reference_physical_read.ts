import {
  createAutoMovieReferenceProvider,
  createAutoMovieReferenceReader,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

import { createReferenceMemoryFileSystem } from "../internal/createReferenceMemoryFileSystem";

/**
 * Source bytes are returned only while pathname, ancestry and handle observations agree.
 *
 * Scenarios:
 * 1. A regular single-link file reads and closes its handle.
 * 2. Links, special entries, aliases, substitutions and concurrent writes refuse.
 * 3. Every failure after opening closes the handle and returns no source content.
 */
export const test_reference_physical_read = async (): Promise<void> => {
  const original = createReferenceMemoryFileSystem();
  const reader = await createAutoMovieReferenceReader(
    original.root,
    original.io,
  );
  TestValidator.equals(
    "normal bytes",
    await reader.read(original.file),
    original.state.bytes,
  );
  TestValidator.equals(
    "normal close",
    original.state.trace.filter((item) => item.operation === "close").length,
    1,
  );
  for (const mutation of [
    "symlink",
    "hardlink",
    "special",
    "directory",
    "alias",
    "opened-inode",
    "opened-device",
    "opened-size-small",
    "opened-kind",
    "ancestor",
    "root",
    "during-write",
    "resident",
    "length",
    "post-alias",
    "post-ancestor",
    "open-error",
    "read-error",
    "close-error",
  ] as const) {
    const memory = createReferenceMemoryFileSystem();
    const bound = await createAutoMovieReferenceReader(memory.root, memory.io);
    const { state, absolute, root } = memory;
    if (mutation === "symlink")
      state.entries.set(absolute, { ...memory.regular, kind: "link" });
    if (mutation === "hardlink")
      state.entries.set(absolute, { ...memory.regular, links: 2n });
    if (mutation === "special")
      state.entries.set(absolute, { ...memory.regular, kind: "other" });
    if (mutation === "directory") state.entries.set(absolute, memory.directory);
    if (mutation === "alias")
      state.aliases.set(absolute, path.join(root, "outside.md"));
    if (mutation === "opened-inode") state.handle.inode = 10n;
    if (mutation === "opened-device") state.handle.device = 10n;
    if (mutation === "opened-size-small") ++state.handle.size;
    if (mutation === "opened-kind") state.handle.kind = "link";
    if (mutation === "ancestor")
      state.entries.set(path.join(root, "docs"), {
        ...memory.directory,
        kind: "link",
      });
    if (mutation === "root")
      state.entries.set(root, { ...memory.directory, inode: 10n });
    state.hook = (operation) => {
      if (operation === "open" && mutation === "open-error")
        throw new Error("private open diagnostic");
      if (operation === "read") {
        if (mutation === "during-write") state.handle.modified = 1n;
        if (mutation === "resident")
          state.entries.set(absolute, { ...memory.regular, inode: 10n });
        if (mutation === "length") state.bytes = new Uint8Array();
        if (mutation === "post-alias")
          state.aliases.set(absolute, path.join(root, "elsewhere.md"));
        if (mutation === "post-ancestor")
          state.entries.set(path.join(root, "docs"), {
            ...memory.directory,
            inode: 10n,
          });
        if (mutation === "read-error")
          throw new Error("private read diagnostic");
      }
      if (operation === "close" && mutation === "close-error")
        throw new Error("private close diagnostic");
    };
    const result = await createAutoMovieReferenceProvider(bound)({
      operation: "read_file_without_annotations",
      file: memory.file,
    });
    TestValidator.equals(
      `refuse ${mutation}`,
      result.ok ? "success" : result.error.code,
      mutation.endsWith("error") ? "IO_ERROR" : "PATH_IDENTITY_CHANGED",
    );
    TestValidator.predicate(
      "no private diagnostics",
      !JSON.stringify(result).includes("private"),
    );
    const opened = state.trace.some((item) => item.operation === "open");
    const closed = state.trace.some((item) => item.operation === "close");
    TestValidator.equals(
      `close ${mutation}`,
      closed,
      opened && mutation !== "open-error",
    );
  }
};
