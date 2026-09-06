import { AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS } from "@automovie/evidence";
import {
  createAutoMovieReferenceProvider,
  parseAutoMovieReferenceRequest,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * Only canonical authored Markdown requests reach the read capability.
 *
 * Scenarios:
 * 1. All authored layers share the allowed path and schema source.
 * 2. Traversal, aliases, reserved names, forbidden populations and extensions refuse.
 * 3. Schema, location and budget boundaries fail before any read operation.
 */
export const test_reference_admission = async (): Promise<void> => {
  let reads = 0;
  const provider = createAutoMovieReferenceProvider({
    read: async () => {
      ++reads;
      return new Uint8Array();
    },
    list: async () => [],
  });
  for (const layer of AUTOMOVIE_AUTHORED_DOCUMENT_LAYERS) {
    const result = await provider({ operation: "get_index_of_layer", layer });
    TestValidator.predicate(`layer ${layer}`, result.ok);
  }
  for (const file of [
    "/docs/settings/a.md",
    "../docs/settings/a.md",
    "docs/settings/../a.md",
    "docs/settings/./a.md",
    "docs/settings//a.md",
    "docs\\settings\\a.md",
    "C:/docs/settings/a.md",
    "//server/docs/settings/a.md",
    "docs/settings/a.md:stream",
    "docs/settings/a.ts",
    "docs/accounts/a.md",
    "docs/contracts/a.md",
    "docs/language/a.md",
    ".env",
    ".wiki/a.md",
    "docs/settings/.secret.md",
    "docs/settings/CON.md",
    "docs/settings/NUL.txt/a.md",
    "docs/settings/name. /a.md",
    "docs/settings/a\u0000.md",
    "docs/settings/a?.md",
    "docs/settings/a#x.md",
    'docs/settings/a"x.md',
    "docs/settings/com¹.md",
  ]) {
    const result = await provider({ operation: "get_index_of_file", file });
    TestValidator.equals(
      `path ${JSON.stringify(file)}`,
      result.ok ? "success" : result.error.code,
      "INVALID_PATH",
    );
  }
  for (const location of [
    "docs/settings/a.md",
    "#anchor",
    "docs/settings/a.md#",
    "docs/settings/a.md#a#b",
  ]) {
    const result = await provider({
      operation: "read_section_without_annotations",
      location,
    });
    TestValidator.equals(
      `location ${location}`,
      result.ok ? "success" : result.error.code,
      "INVALID_LOCATION",
    );
  }
  TestValidator.equals("refusals do not read", reads, 0);
  for (const input of [
    {},
    { operation: "get_index_of_layer", layer: "accounts" },
    { operation: "get_index_of_layer", layer: "settings", limit: 0 },
  ]) {
    const result = await provider(input);
    TestValidator.equals(
      "request failure classification",
      result.ok ? "success" : result.error.code,
      "layer" in input && input.layer === "accounts"
        ? "INVALID_LAYER"
        : "INVALID_REQUEST",
    );
  }
  for (const input of [
    null,
    {},
    { operation: "compile" },
    { operation: "get_index_of_layer", layer: "accounts" },
    { operation: "get_index_of_file", file: "a", root: "other" },
    { operation: "get_index_of_layer", layer: "settings", limit: 0 },
    { operation: "get_index_of_layer", layer: "settings", limit: 101 },
    { operation: "get_index_of_file", file: "a", budgetBytes: 255 },
    { operation: "get_index_of_file", file: "a", budgetBytes: 1_048_577 },
    { operation: "get_index_of_file", file: "a", budgetBytes: 256.5 },
    {
      operation: "read_file_without_annotations",
      file: "a",
      expectedDigest: "old",
    },
    {
      operation: "get_index_of_layer",
      layer: "settings",
      continuation: { revision: "0".repeat(64), offset: 0 },
    },
  ]) {
    TestValidator.equals(
      "invalid schema",
      parseAutoMovieReferenceRequest(input),
      null,
    );
  }
  for (const budgetBytes of [256, 1_048_576])
    TestValidator.equals(
      "budget endpoint admitted",
      parseAutoMovieReferenceRequest({
        operation: "get_index_of_file",
        file: "a",
        budgetBytes,
      })?.budgetBytes,
      budgetBytes,
    );
  TestValidator.equals(
    "default budget",
    parseAutoMovieReferenceRequest({
      operation: "get_index_of_file",
      file: "a",
    })?.budgetBytes,
    65_536,
  );
  for (const limit of [1, 100])
    TestValidator.predicate(
      "page endpoint admitted",
      parseAutoMovieReferenceRequest({
        operation: "get_index_of_layer",
        layer: "settings",
        limit,
      }) !== null,
    );
  const allowed = await provider({
    operation: "get_index_of_file",
    file: "docs/settings/한글 space.md",
  });
  TestValidator.predicate("Unicode and spaces allowed", allowed.ok);
  TestValidator.equals("allowed read happens once", reads, 1);
};
