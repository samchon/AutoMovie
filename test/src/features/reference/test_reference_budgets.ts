import { createAutoMovieReferenceProvider } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * Budgets count serialized UTF-8 bytes and refuse every incomplete result.
 *
 * Scenarios:
 * 1. Exact result budgets succeed and one byte less refuses without content.
 * 2. Oversized source and inventory limits refuse before parsing the population.
 * 3. Large annotations do not inflate the default per-comment metadata surface.
 */
export const test_reference_budgets = async (): Promise<void> => {
  const file = "docs/research/source.md";
  let bytes: Uint8Array = Buffer.from(
    "## Source {#source}\n한글😀\n" + "<!-- note -->\n".repeat(30),
  );
  let paths = [file];
  const provider = createAutoMovieReferenceProvider({
    read: async () => bytes,
    list: async () => paths,
  });
  for (const operation of [
    "get_index_of_file",
    "read_file_without_annotations",
  ] as const) {
    const result = await provider({ operation, file });
    if (!result.ok) throw new Error("Expected normal result.");
    const budgetBytes = Buffer.byteLength(JSON.stringify(result));
    TestValidator.predicate("budget above minimum", budgetBytes >= 256);
    TestValidator.equals(
      "exact budget",
      await provider({ operation, file, budgetBytes }),
      result,
    );
    const less = await provider({
      operation,
      file,
      budgetBytes: budgetBytes - 1,
    });
    TestValidator.equals(
      "one byte short",
      less.ok ? "success" : less.error.code,
      "BUDGET_EXCEEDED",
    );
    TestValidator.predicate(
      "default metadata excludes annotation ranges",
      !JSON.stringify(result).includes("annotationRanges"),
    );
  }
  bytes = new Uint8Array(8_388_609);
  const large = await provider({ operation: "get_index_of_file", file });
  TestValidator.equals(
    "source bound",
    large.ok ? "success" : large.error.code,
    "RESOURCE_LIMIT",
  );
  const layerSource = await provider({
    operation: "get_index_of_layer",
    layer: "research",
  });
  TestValidator.equals(
    "layer individual source bound",
    layerSource.ok ? "success" : layerSource.error.code,
    "RESOURCE_LIMIT",
  );
  paths = Array.from({ length: 10_001 }, (_, i) => `docs/research/${i}.md`);
  const inventory = await provider({
    operation: "get_index_of_layer",
    layer: "research",
  });
  TestValidator.equals(
    "inventory bound",
    inventory.ok ? "success" : inventory.error.code,
    "RESOURCE_LIMIT",
  );
  paths = Array.from({ length: 5 }, (_, i) => `docs/research/${i}.md`);
  bytes = new Uint8Array(8_388_608);
  const total = await provider({
    operation: "get_index_of_layer",
    layer: "research",
  });
  TestValidator.equals(
    "aggregate bound",
    total.ok ? "success" : total.error.code,
    "RESOURCE_LIMIT",
  );
};
