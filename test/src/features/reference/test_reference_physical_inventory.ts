import { createAutoMovieReferenceReader } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

import { createReferenceMemoryFileSystem } from "../internal/createReferenceMemoryFileSystem";

/**
 * Physical inventories expose an exact finite population without masking mid-read loss.
 *
 * Scenarios:
 * 1. Exactly 10,000 injected regular files enumerate; the next file exceeds the limit.
 * 2. A hard-linked entry, disappearing population and absent root refuse rather than
 *    becoming an empty successful layer; no operating-system path is accessed.
 */
export const test_reference_physical_inventory = async (): Promise<void> => {
  const memory = createReferenceMemoryFileSystem();
  const layer = path.join(memory.root, "docs/settings");
  const names = Array.from({ length: 10_000 }, (_, i) => `${i}.md`);
  for (const name of names)
    memory.state.entries.set(path.join(layer, name), memory.regular);
  memory.state.listings.set(layer, names);
  const reader = await createAutoMovieReferenceReader(memory.root, memory.io);
  TestValidator.equals(
    "exact inventory limit",
    (await reader.list("settings")).length,
    10_000,
  );
  names.push("overflow.md");
  memory.state.entries.set(path.join(layer, "overflow.md"), memory.regular);
  let limitCode = "success";
  try {
    await reader.list("settings");
  } catch (error) {
    limitCode = (error as { code: string }).code;
  }
  TestValidator.equals("inventory overflow", limitCode, "RESOURCE_LIMIT");
  for (const mutation of [
    "hardlink",
    "population-loss",
    "root-loss",
    "primitive-error",
  ] as const) {
    const changed = createReferenceMemoryFileSystem();
    const bound = await createAutoMovieReferenceReader(
      changed.root,
      changed.io,
    );
    if (mutation === "hardlink")
      changed.state.entries.set(changed.absolute, {
        ...changed.regular,
        links: 2n,
      });
    if (mutation === "root-loss") changed.state.entries.delete(changed.root);
    changed.state.hook = (operation) => {
      if (mutation === "population-loss" && operation === "list")
        changed.state.entries.delete(changed.absolute);
      if (mutation === "primitive-error" && operation === "lstat") {
        // eslint-disable-next-line typescript/only-throw-error -- the reader must classify a null native failure without accessing its properties
        throw null;
      }
    };
    let code = "success";
    try {
      await bound.list("settings");
    } catch (error) {
      code = (error as { code: string }).code;
    }
    TestValidator.equals(
      `inventory observation ${mutation}`,
      code,
      mutation === "hardlink"
        ? "PATH_IDENTITY_CHANGED"
        : mutation === "primitive-error"
          ? "IO_ERROR"
          : "MISSING_FILE",
    );
  }
};
