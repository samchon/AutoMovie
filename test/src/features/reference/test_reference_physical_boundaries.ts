import {
  createAutoMovieReferenceProvider,
  createAutoMovieReferenceReader,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

import { parseReference } from "../../../../packages/mcp/src/internal/parseReference";
import { createReferenceMemoryFileSystem } from "../internal/createReferenceMemoryFileSystem";

/**
 * Startup and resource boundary refusals preserve source isolation.
 *
 * Scenarios:
 * 1. Relative roots, linked root ancestry and startup identity changes refuse.
 * 2. Metadata, handle and post-read size/link changes never return bytes.
 * 3. Injected parser failure is classified without echoing parser diagnostics.
 */
export const test_reference_physical_boundaries = async (): Promise<void> => {
  for (const mutation of [
    "relative",
    "root-link",
    "root-alias",
    "parent-link",
    "parent-alias",
    "startup-change",
  ] as const) {
    const memory = createReferenceMemoryFileSystem();
    if (mutation === "root-link")
      memory.state.entries.set(memory.root, {
        ...memory.directory,
        kind: "link",
      });
    if (mutation === "root-alias")
      memory.state.aliases.set(
        memory.root,
        path.join(memory.root, "elsewhere"),
      );
    if (mutation === "parent-link")
      memory.state.entries.set(path.dirname(memory.root), {
        ...memory.directory,
        kind: "link",
      });
    if (mutation === "parent-alias")
      memory.state.aliases.set(
        path.dirname(memory.root),
        path.join(memory.root, "elsewhere"),
      );
    let roots = 0;
    if (mutation === "startup-change")
      memory.state.hook = (operation, location) => {
        if (operation === "lstat" && location === memory.root && ++roots === 2)
          memory.state.entries.set(memory.root, {
            ...memory.directory,
            inode: 3n,
          });
      };
    let code = "success";
    try {
      await createAutoMovieReferenceReader(
        mutation === "relative" ? "relative" : memory.root,
        memory.io,
      );
    } catch (error) {
      code = (error as { code: string }).code;
    }
    TestValidator.equals(
      `startup ${mutation}`,
      code,
      mutation === "relative" ? "INVALID_ROOT" : "PATH_IDENTITY_CHANGED",
    );
  }
  for (const mutation of [
    "oversized-bytes",
    "opened-size",
    "after-size",
    "after-links",
    "changed-time",
    "ancestor-alias",
    "root-alias-after-bind",
  ] as const) {
    const memory = createReferenceMemoryFileSystem();
    const reader = await createAutoMovieReferenceReader(memory.root, memory.io);
    if (mutation === "opened-size") memory.state.handle.size = 8_388_609n;
    if (mutation === "root-alias-after-bind")
      memory.state.aliases.set(
        memory.root,
        path.join(memory.root, "elsewhere"),
      );
    memory.state.hook = (operation) => {
      if (operation !== "read") return;
      if (mutation === "oversized-bytes")
        memory.state.bytes = new Uint8Array(8_388_609);
      if (mutation === "after-size") memory.state.handle.size = 8_388_609n;
      if (mutation === "after-links") memory.state.handle.links = 2n;
      if (mutation === "changed-time") memory.state.handle.changed = 1n;
      if (mutation === "ancestor-alias")
        memory.state.aliases.set(
          path.join(memory.root, "docs"),
          path.join(memory.root, "other"),
        );
    };
    const result = await createAutoMovieReferenceProvider(reader)({
      operation: "get_index_of_file",
      file: memory.file,
    });
    TestValidator.equals(
      `read boundary ${mutation}`,
      result.ok ? "success" : result.error.code,
      ["oversized-bytes", "opened-size", "after-size"].includes(mutation)
        ? "RESOURCE_LIMIT"
        : "PATH_IDENTITY_CHANGED",
    );
  }
  let parserCode = "success";
  try {
    await parseReference(
      "docs/settings/a.md",
      Buffer.from("plain"),
      async () => {
        throw new Error("private parser data");
      },
    );
  } catch (error) {
    parserCode = (error as { code: string }).code;
    TestValidator.predicate(
      "parser message sanitized",
      !(error as Error).message.includes("private"),
    );
  }
  TestValidator.equals("parser failure", parserCode, "PARSER_ERROR");
  const failedHtmlParser = class {
    constructor() {
      throw new Error("private HTML diagnostic");
    }
  } as unknown as Awaited<
    ReturnType<NonNullable<Parameters<typeof parseReference>[2]>>
  >["Parser"];
  let htmlCode = "success";
  try {
    await parseReference(
      "docs/settings/a.md",
      Buffer.from("plain"),
      async () => ({
        tree: { type: "root", children: [] },
        Parser: failedHtmlParser,
      }),
    );
  } catch (error) {
    htmlCode = (error as { code: string }).code;
    TestValidator.predicate(
      "HTML failure sanitized",
      !(error as Error).message.includes("private"),
    );
  }
  TestValidator.equals("HTML parser failure", htmlCode, "PARSER_ERROR");
};
