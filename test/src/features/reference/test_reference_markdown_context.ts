import { createAutoMovieReferenceProvider } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * Projection uses syntax context while retaining source bytes and original addresses.
 *
 * Scenarios:
 * 1. Inline raw-text HTML, attributes, code and escapes retain comment-like literals.
 * 2. Actual comments disappear around headings without admitting commented examples.
 * 3. Empty, adjacent and out-of-subtree annotations reconstruct through exact ranges.
 */
export const test_reference_markdown_context = async (): Promise<void> => {
  const file = "docs/models/model.md";
  for (const [source, expected] of [
    [
      "prefix <script><!-- script literal --></script> suffix",
      "prefix <script><!-- script literal --></script> suffix",
    ],
    [
      "prefix <textarea><!-- text literal --></textarea> suffix",
      "prefix <textarea><!-- text literal --></textarea> suffix",
    ],
    [
      "    <!-- indented literal -->\n    ## code\n",
      "    <!-- indented literal -->\n    ## code\n",
    ],
    [
      "~~~html\n<!-- fenced literal -->\n~~~\n",
      "~~~html\n<!-- fenced literal -->\n~~~\n",
    ],
    [
      "``multi\n<!-- inline literal -->\nline``",
      "``multi\n<!-- inline literal -->\nline``",
    ],
    ["<!-- a --><!-- b -->", ""],
    ["prefix <!-- unclosed", "prefix <!-- unclosed"],
    ["<![CDATA[<!-- literal -->]]>", "<![CDATA[<!-- literal -->]]>"],
    [
      "<!DOCTYPE html>\n\n<?instruction?>\n\n<!-- remove -->",
      "<!DOCTYPE html>\n\n<?instruction?>\n\n",
    ],
    [
      "<!--\n```\n## fake {#fake}\n-->\n\n## Real <!-- hidden --> {#real}\nbody",
      "\n\n## Real  {#real}\nbody",
    ],
  ]) {
    const provider = createAutoMovieReferenceProvider({
      read: async () => Buffer.from(source),
      list: async () => [file],
    });
    const result = await provider({
      operation: "read_file_without_annotations",
      file,
      detail: true,
    });
    if (
      !result.ok ||
      !("content" in result.data) ||
      result.data.projection === undefined
    )
      throw new Error("Expected source projection.");
    TestValidator.equals(
      "context keeps original content",
      result.data.content,
      expected,
    );
    TestValidator.equals(
      "context pieces reconstruct",
      result.data.projection.contentRanges
        .map((range) => source.slice(range.start.offset, range.end.offset))
        .join(""),
      expected,
    );
  }
  const source =
    "<!-- before -->\n\n## A {#a}\n<!-- inside -->\nA\n\n## B {#b}\n<!-- after -->\nB";
  const provider = createAutoMovieReferenceProvider({
    read: async () => Buffer.from(source),
    list: async () => [file],
  });
  const section = await provider({
    operation: "read_section_without_annotations",
    location: `${file}#a`,
    detail: true,
  });
  if (
    !section.ok ||
    !("content" in section.data) ||
    section.data.projection === undefined
  )
    throw new Error("Expected subtree projection.");
  TestValidator.equals(
    "only subtree comments",
    section.data.projection.annotationRanges.length,
    1,
  );
  TestValidator.equals("only subtree content", section.data.content, "\nA\n\n");
};
