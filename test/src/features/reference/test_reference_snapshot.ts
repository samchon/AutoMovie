import { createAutoMovieReferenceProvider } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

import { referenceParser } from "../internal/referenceSourceModules";

const { parseReference } = referenceParser;

/**
 * Snapshot metadata cannot drift when an injected reader reuses mutable byte storage.
 *
 * Scenarios:
 * 1. Mutation during asynchronous syntax loading leaves decoded source and its
 *    digest tied to the bytes observed before that boundary.
 * 2. A layer reader reusing one buffer retains each file's original title/revision.
 */
export const test_reference_snapshot = async (): Promise<void> => {
  const bytes = Buffer.from("A");
  const originalDigest = createHash("sha256").update("A").digest("hex");
  const emptyParser = class {
    end(): void {}
  } as unknown as Awaited<
    ReturnType<NonNullable<Parameters<typeof parseReference>[2]>>
  >["Parser"];
  const parsed = await parseReference("docs/settings/a.md", bytes, async () => {
    bytes[0] = 66;
    return { tree: { type: "root", children: [] }, Parser: emptyParser };
  });
  TestValidator.equals("mutation happened", bytes.toString(), "B");
  TestValidator.equals("source snapshot", parsed.source, "A");
  TestValidator.equals("digest snapshot", parsed.revision, originalDigest);
  TestValidator.equals("byte count snapshot", parsed.sourceBytes, 1);
  const shared = Buffer.from("# A\n");
  const provider = createAutoMovieReferenceProvider({
    list: async () => ["docs/settings/a.md", "docs/settings/b.md"],
    read: async (file) => {
      shared[2] = file.endsWith("/a.md") ? 65 : 66;
      return shared;
    },
  });
  const result = await provider({
    operation: "get_index_of_layer",
    layer: "settings",
  });
  if (!result.ok || !("files" in result.data))
    throw new Error("Expected a layer.");
  TestValidator.equals(
    "per-read source titles",
    result.data.files.map((file) => file.title),
    ["A", "B"],
  );
  TestValidator.equals(
    "per-read byte revisions",
    result.data.files.map((file) => file.revision),
    ["# A\n", "# B\n"].map((source) =>
      createHash("sha256").update(source).digest("hex"),
    ),
  );
};
