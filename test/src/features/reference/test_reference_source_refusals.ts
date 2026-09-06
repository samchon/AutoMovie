import { createAutoMovieReferenceProvider } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * A source revision and annotation projection always describe the same bytes.
 *
 * Scenarios:
 * 1. Unclosed annotation content is omitted and only its location is diagnosed.
 * 2. Invalid UTF-8 refuses rather than silently replacing bytes.
 * 3. A same-source digest succeeds, but an edited file rejects the old digest.
 */
export const test_reference_source_refusals = async (): Promise<void> => {
  const file = "docs/settings/place.md";
  let bytes: Uint8Array = Buffer.from(
    "## Place {#place}\nvisible\n\n<!-- secret\n## fake {#fake}",
  );
  const provider = createAutoMovieReferenceProvider({
    read: async () => bytes,
    list: async () => [file],
  });
  const result = await provider({
    operation: "read_file_without_annotations",
    file,
    detail: true,
  });
  if (!result.ok || !("content" in result.data))
    throw new Error("Expected content.");
  TestValidator.equals(
    "omit through EOF",
    result.data.content,
    "## Place {#place}\nvisible\n\n",
  );
  TestValidator.equals(
    "diagnostic code",
    result.data.diagnostics.map((item) => item.code),
    ["UNTERMINATED_ANNOTATION"],
  );
  TestValidator.predicate(
    "annotation not echoed",
    !JSON.stringify(result).includes("secret"),
  );
  const revision = result.data.revision;
  const current = await provider({
    operation: "read_section_without_annotations",
    location: `${file}#place`,
    expectedDigest: revision,
  });
  TestValidator.predicate("same digest", current.ok);
  bytes = Buffer.from("## Place {#place}\nchanged");
  const stale = await provider({
    operation: "read_file_without_annotations",
    file,
    expectedDigest: revision,
  });
  TestValidator.equals(
    "stale digest",
    stale.ok ? "success" : stale.error.code,
    "STALE_REFERENCE",
  );
  bytes = new Uint8Array([0xc3, 0x28]);
  const invalid = await provider({ operation: "get_index_of_file", file });
  TestValidator.equals(
    "fatal UTF-8",
    invalid.ok ? "success" : invalid.error.code,
    "INVALID_UTF8",
  );
  const failed = createAutoMovieReferenceProvider({
    read: async () => {
      throw new Error("sensitive external diagnostic");
    },
    list: async () => [],
  });
  const unexpected = await failed({ operation: "get_index_of_file", file });
  TestValidator.equals(
    "unexpected IO classified",
    unexpected.ok ? "success" : unexpected.error.code,
    "IO_ERROR",
  );
  TestValidator.predicate(
    "unexpected error sanitized",
    !JSON.stringify(unexpected).includes("sensitive"),
  );
};
