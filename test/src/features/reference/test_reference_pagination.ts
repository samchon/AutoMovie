import { createAutoMovieReferenceProvider } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * Layer pages have deterministic order and cannot combine different revisions.
 *
 * Scenarios:
 * 1. Explicit and default pages return bounded sorted file indices with continuation.
 * 2. Source edits, out-of-range continuations and duplicate identities refuse.
 * 3. A smaller budget reduces a page or fails explicitly without truncating a file.
 */
export const test_reference_pagination = async (): Promise<void> => {
  let paths = [
    "docs/treatments/b.md",
    "docs/treatments/a.md",
    "docs/treatments/c.md",
  ];
  let suffix = "";
  const provider = createAutoMovieReferenceProvider({
    read: async (file) => Buffer.from(`# ${file}\n${suffix}`),
    list: async () => paths,
  });
  const first = await provider({
    operation: "get_index_of_layer",
    layer: "treatments",
    limit: 1,
  });
  if (!first.ok || !("files" in first.data) || first.data.continuation === null)
    throw new Error("Expected a partial page.");
  TestValidator.equals(
    "stable order",
    first.data.files.map((item) => item.file),
    ["docs/treatments/a.md"],
  );
  TestValidator.equals(
    "partial disclosed",
    {
      total: first.data.total,
      offset: first.data.continuation.offset,
      atomic: first.data.atomic,
    },
    { total: 3, offset: 1, atomic: false },
  );
  const next = await provider({
    operation: "get_index_of_layer",
    layer: "treatments",
    continuation: first.data.continuation,
  });
  if (!next.ok || !("files" in next.data))
    throw new Error("Expected next page.");
  TestValidator.equals(
    "remaining order",
    next.data.files.map((item) => item.file),
    ["docs/treatments/b.md", "docs/treatments/c.md"],
  );
  TestValidator.equals("complete disclosed", next.data.continuation, null);
  const oneBudget = Buffer.byteLength(JSON.stringify(first));
  const bounded = await provider({
    operation: "get_index_of_layer",
    layer: "treatments",
    budgetBytes: oneBudget,
  });
  TestValidator.equals("budget selects whole file", bounded, first);
  const tooSmall = await provider({
    operation: "get_index_of_layer",
    layer: "treatments",
    budgetBytes: oneBudget - 1,
  });
  TestValidator.equals(
    "minimum item cannot fit",
    tooSmall.ok ? "success" : tooSmall.error.code,
    "BUDGET_EXCEEDED",
  );
  const outside = await provider({
    operation: "get_index_of_layer",
    layer: "treatments",
    continuation: { revision: first.data.revision, offset: 4 },
  });
  TestValidator.equals(
    "invalid offset",
    outside.ok ? "success" : outside.error.code,
    "INVALID_CONTINUATION",
  );
  suffix = "changed";
  const stale = await provider({
    operation: "get_index_of_layer",
    layer: "treatments",
    continuation: first.data.continuation,
  });
  TestValidator.equals(
    "source-bound pages",
    stale.ok ? "success" : stale.error.code,
    "STALE_REFERENCE",
  );
  paths = ["docs/treatments/a.md", "docs/treatments/a.md"];
  const duplicate = await provider({
    operation: "get_index_of_layer",
    layer: "treatments",
  });
  TestValidator.equals(
    "duplicate identity",
    duplicate.ok ? "success" : duplicate.error.code,
    "PATH_IDENTITY_CHANGED",
  );
  paths = ["docs/settings/a.md"];
  const mismatched = await provider({
    operation: "get_index_of_layer",
    layer: "treatments",
  });
  TestValidator.equals(
    "wrong population",
    mismatched.ok ? "success" : mismatched.error.code,
    "PATH_IDENTITY_CHANGED",
  );
  paths = [];
  const empty = await provider({
    operation: "get_index_of_layer",
    layer: "treatments",
  });
  if (!empty.ok || !("files" in empty.data))
    throw new Error("Expected empty page.");
  TestValidator.equals(
    "empty complete",
    {
      files: empty.data.files,
      total: empty.data.total,
      continuation: empty.data.continuation,
    },
    { files: [], total: 0, continuation: null },
  );
};
