import { createAutoMovieReferenceProvider } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * A reference is an exact original-source projection rather than an edition.
 *
 * Scenarios:
 * 1. Mixed Unicode and CRLF retain their original UTF-16 range coordinates.
 * 2. Comments disappear while code, escaped literals, HTML, scene carriers and
 *    timing selectors retain their exact bytes.
 * 3. Detail ranges reconstruct content and compact reads omit those arrays.
 */
export const test_reference_projection = async (): Promise<void> => {
  const file = "docs/screenplays/01/unit.md";
  const source =
    '# 題😀 {#title}\r\n\r\n## 한글 {#scene_a}\r\n가😀<!-- secret -->中<!-- two -->日\r\n\r\n```md\r\n<!-- literal -->\r\n## fake {#fake}\r\n```\r\n\r\n`<!-- inline -->` \\<!-- escaped -->\r\n\r\n<div title="<!-- attribute -->">HTML</div>\r\n\r\n@automovie-scene scene_a\r\n{@timing shot:shot_a/entry 1.25s}\r\n@end-automovie-scene';
  const expected = source
    .replace("<!-- secret -->", "")
    .replace("<!-- two -->", "");
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
    throw new Error("Expected a detailed content result.");
  TestValidator.equals("original projection", result.data.content, expected);
  TestValidator.equals(
    "content byte accounting",
    result.data.contentBytes,
    Buffer.byteLength(expected),
  );
  TestValidator.equals(
    "source byte accounting",
    result.data.sourceBytes,
    Buffer.byteLength(source),
  );
  TestValidator.equals(
    "piece reconstruction",
    result.data.projection.contentRanges
      .map((range) => source.slice(range.start.offset, range.end.offset))
      .join(""),
    expected,
  );
  const first = result.data.projection.annotationRanges[0];
  TestValidator.equals(
    "UTF-16 start",
    { line: first.start.line, column: first.start.column },
    { line: 4, column: 4 },
  );
  TestValidator.equals(
    "source interval",
    source.slice(first.start.offset, first.end.offset),
    "<!-- secret -->",
  );
  TestValidator.equals("EOF", result.data.range.end.offset, source.length);
  const compact = await provider({
    operation: "read_file_without_annotations",
    file,
  });
  TestValidator.predicate(
    "detail is opt-in",
    compact.ok && !("projection" in compact.data),
  );
  const index = await provider({ operation: "get_index_of_file", file });
  if (!index.ok || !("headings" in index.data))
    throw new Error("Expected an index.");
  TestValidator.equals(
    "fake heading excluded",
    index.data.headings.map((heading) => heading.anchor),
    ["scene_a"],
  );
};
