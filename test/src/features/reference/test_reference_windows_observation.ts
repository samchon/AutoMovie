import {
  createAutoMovieReferenceProvider,
  createAutoMovieReferenceReader,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { createReferenceMemoryFileSystem } from "../internal/createReferenceMemoryFileSystem";

/**
 * Windows observation differences do not erase physical generation checks.
 *
 * Scenarios:
 * 1. Path/handle device differences and own-open ctime changes permit a read.
 * 2. Path replacement, content metadata changes and a different resident
 *    handle refuse, including mutations at the corroborating open boundary.
 * 3. Read, corroboration and close failures return no bytes and close handles.
 */
export const test_reference_windows_observation = async (): Promise<void> => {
  for (const mutation of [
    "none",
    "opened-inode",
    "opened-mtime",
    "path-device",
    "path-inode",
    "handle-device",
    "handle-inode",
    "handle-mtime",
    "resident-device",
    "resident-inode",
    "resident-size",
    "resident-links",
    "final-inode",
    "final-mtime",
    "final-link",
    "final-alias",
    "read-failure",
    "open-failure",
    "stat-failure",
    "close-failure",
  ] as const) {
    const memory = createReferenceMemoryFileSystem();
    memory.state.entries.get(memory.absolute)!.device = 0n;
    let opens = 0;
    let closes = 0;
    memory.state.hook = (operation, location) => {
      const resident = memory.state.entries.get(memory.absolute)!;
      if (operation === "open") {
        ++opens;
        resident.changed += 1n;
        memory.state.handle.changed += 1n;
        if (opens === 1) {
          if (mutation === "opened-inode") memory.state.handle.inode = 9n;
          if (mutation === "opened-mtime") memory.state.handle.modified += 1n;
        }
        if (opens === 2) {
          if (mutation === "open-failure") throw new Error("open failed");
          if (mutation === "resident-device") memory.state.handle.device = 9n;
          if (mutation === "resident-inode") memory.state.handle.inode = 9n;
          if (mutation === "resident-size") memory.state.handle.size += 1n;
          if (mutation === "resident-links") memory.state.handle.links = 2n;
          if (mutation === "final-inode") resident.inode = 9n;
          if (mutation === "final-mtime") resident.modified += 1n;
          if (mutation === "final-link") resident.kind = "link";
          if (mutation === "final-alias")
            memory.state.aliases.set(
              memory.absolute,
              `${memory.absolute}.other`,
            );
        }
      }
      if (operation === "read") {
        if (mutation === "read-failure") throw new Error("read failed");
        if (mutation === "path-device") resident.device = 9n;
        if (mutation === "path-inode") resident.inode = 9n;
        if (mutation === "handle-device") memory.state.handle.device = 9n;
        if (mutation === "handle-inode") memory.state.handle.inode = 9n;
        if (mutation === "handle-mtime") memory.state.handle.modified += 1n;
      }
      if (operation === "stat" && opens === 2 && mutation === "stat-failure")
        throw new Error("stat failed");
      if (operation === "close" && location === memory.absolute) {
        ++closes;
        if (mutation === "close-failure" && closes === 1)
          throw new Error("close failed");
      }
    };
    const reader = await createAutoMovieReferenceReader(memory.root, {
      ...memory.io,
      platform: "win32",
    });
    const result = await createAutoMovieReferenceProvider(reader)({
      operation: "get_index_of_file",
      file: memory.file,
    });
    TestValidator.equals(
      `Windows observation ${mutation}`,
      result.ok ? "success" : result.error.code,
      mutation === "none"
        ? "success"
        : mutation.endsWith("failure")
          ? "IO_ERROR"
          : "PATH_IDENTITY_CHANGED",
    );
    TestValidator.equals(
      `every acquired handle closes for ${mutation}`,
      closes,
      opens - (mutation === "open-failure" ? 1 : 0),
    );
  }
};
