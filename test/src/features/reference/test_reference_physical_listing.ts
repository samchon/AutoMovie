import {
  createAutoMovieReferenceProvider,
  createAutoMovieReferenceReader,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import * as path from "node:path";

import { createReferenceMemoryFileSystem } from "../internal/createReferenceMemoryFileSystem";

/**
 * Enumeration distinguishes empty layers from failed physical observations.
 *
 * Scenarios:
 * 1. Hidden entries and non-Markdown files do not enter the authored inventory.
 * 2. Missing layers succeed empty while permission, file absence and replaced paths fail.
 * 3. Linked entries, malformed names, deep traversal and oversized files refuse.
 */
export const test_reference_physical_listing = async (): Promise<void> => {
  const memory = createReferenceMemoryFileSystem();
  const layer = path.join(memory.root, "docs/settings");
  memory.state.listings.set(layer, [".gitkeep", "note.txt", "nested", "a.md"]);
  memory.state.entries.set(path.join(layer, "note.txt"), memory.regular);
  memory.state.entries.set(path.join(layer, "nested"), memory.directory);
  memory.state.listings.set(path.join(layer, "nested"), []);
  const reader = await createAutoMovieReferenceReader(memory.root, memory.io);
  TestValidator.equals("visible Markdown only", await reader.list("settings"), [
    memory.file,
  ]);
  TestValidator.equals("missing population", await reader.list("research"), []);
  TestValidator.predicate(
    "hidden bytes untouched",
    !memory.state.trace.some((item) => item.location.includes(".gitkeep")),
  );
  const provider = createAutoMovieReferenceProvider(reader);
  const missing = await provider({
    operation: "get_index_of_file",
    file: "docs/settings/missing.md",
  });
  TestValidator.equals(
    "missing exact file",
    missing.ok ? "success" : missing.error.code,
    "MISSING_FILE",
  );
  for (const code of ["EACCES", "EPERM", "ELOOP", "ENOTDIR", "UNKNOWN"]) {
    memory.state.hook = (operation) => {
      if (operation === "lstat")
        throw Object.assign(new Error("private"), { code });
    };
    const result = await provider({
      operation: "get_index_of_layer",
      layer: "settings",
    });
    TestValidator.equals(
      `classified ${code}`,
      result.ok ? "success" : result.error.code,
      code === "EACCES" || code === "EPERM"
        ? "PERMISSION_DENIED"
        : code === "ELOOP" || code === "ENOTDIR"
          ? "PATH_IDENTITY_CHANGED"
          : "IO_ERROR",
    );
  }
  memory.state.hook = () => undefined;
  for (const kind of ["link", "other"] as const) {
    memory.state.entries.set(memory.absolute, { ...memory.regular, kind });
    const result = await provider({
      operation: "get_index_of_layer",
      layer: "settings",
    });
    TestValidator.equals(
      "linked listing",
      result.ok ? "success" : result.error.code,
      "PATH_IDENTITY_CHANGED",
    );
  }
  memory.state.entries.set(memory.absolute, {
    ...memory.regular,
    size: 8_388_609n,
  });
  const large = await provider({
    operation: "read_file_without_annotations",
    file: memory.file,
  });
  TestValidator.equals(
    "size metadata bound",
    large.ok ? "success" : large.error.code,
    "RESOURCE_LIMIT",
  );
  memory.state.listings.set(layer, ["bad:name.md"]);
  const invalid = await provider({
    operation: "get_index_of_layer",
    layer: "settings",
  });
  TestValidator.equals(
    "invalid enumerated path",
    invalid.ok ? "success" : invalid.error.code,
    "INVALID_PATH",
  );
  memory.state.listings.set(layer, ["level"]);
  let nested = layer;
  for (let depth = 1; depth <= 33; ++depth) {
    nested = path.join(nested, "level");
    memory.state.entries.set(nested, memory.directory);
    memory.state.listings.set(nested, ["level"]);
  }
  const deep = await provider({
    operation: "get_index_of_layer",
    layer: "settings",
  });
  TestValidator.equals(
    "depth bound",
    deep.ok ? "success" : deep.error.code,
    "RESOURCE_LIMIT",
  );
};
