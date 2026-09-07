import { createAutoMovieReferenceProvider } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

/**
 * Explicit source identity and heading depth decide the exact subtree.
 *
 * Scenarios:
 * 1. H2/H3/H4 reads end before the next sibling or parent and retain descendants.
 * 2. Missing, repeated and unsupported anchors refuse while drafts remain readable.
 * 3. H1 absence, group indices, empty files and final headings invent no title.
 */
export const test_reference_navigation = async (): Promise<void> => {
  const file = "docs/briefs/unit.md";
  let source =
    "## Owner {#owner}\nroot\n### Shot {#shot}\nshot\n#### Beat {#beat}\nbeat\n#### End {#end}\nend\n### Next {#next}\nnext\n## Last {#last}\n";
  const provider = createAutoMovieReferenceProvider({
    read: async () => Buffer.from(source),
    list: async () => [file],
  });
  for (const [anchor, content] of [
    [
      "owner",
      "root\n### Shot {#shot}\nshot\n#### Beat {#beat}\nbeat\n#### End {#end}\nend\n### Next {#next}\nnext\n",
    ],
    ["shot", "shot\n#### Beat {#beat}\nbeat\n#### End {#end}\nend\n"],
    ["beat", "beat\n"],
    ["end", "end\n"],
    ["last", ""],
  ]) {
    const result = await provider({
      operation: "read_section_without_annotations",
      location: `${file}#${anchor}`,
      detail: true,
    });
    if (!result.ok || !("content" in result.data))
      throw new Error("Expected a section.");
    TestValidator.equals(`subtree ${anchor}`, result.data.content, content);
    TestValidator.equals(
      "selected heading separated",
      result.data.heading?.anchor,
      anchor,
    );
  }
  const index = await provider({ operation: "get_index_of_file", file });
  if (!index.ok || !("headings" in index.data))
    throw new Error("Expected an index.");
  TestValidator.equals("no fabricated title", index.data.title, null);
  TestValidator.equals(
    "original parents",
    index.data.headings.map((heading) => heading.parent),
    [null, 0, 1, 1, 0, null],
  );
  source = "# Group {#group}\n\n[Unit](unit.md)\n";
  const group = await provider({ operation: "get_index_of_file", file });
  if (!group.ok || !("headings" in group.data))
    throw new Error("Expected a group index.");
  TestValidator.equals("group title", group.data.title, "Group");
  TestValidator.equals("group is not invented unit", group.data.headings, []);
  source =
    "# Top {#top}\n\n## Draft\n\n## One {#same}\n\n## Two {#same}\n\n##### Deep {#deep}\n\n###### Last {#six}";
  for (const [anchor, code] of [
    ["absent", "MISSING_SECTION"],
    ["same", "AMBIGUOUS_ANCHOR"],
    ["top", "UNSUPPORTED_DEPTH"],
    ["deep", "UNSUPPORTED_DEPTH"],
    ["six", "UNSUPPORTED_DEPTH"],
  ]) {
    const result = await provider({
      operation: "read_section_without_annotations",
      location: `${file}#${anchor}`,
    });
    TestValidator.equals(
      `refusal ${anchor}`,
      result.ok ? "success" : result.error.code,
      code,
    );
  }
  const draft = await provider({ operation: "get_index_of_file", file });
  if (!draft.ok || !("headings" in draft.data))
    throw new Error("Expected draft index.");
  TestValidator.equals(
    "draft status",
    draft.data.headings.map((heading) => heading.addressability),
    ["unaddressable", "ambiguous", "ambiguous"],
  );
  const rawDraft = await provider({
    operation: "read_file_without_annotations",
    file,
  });
  TestValidator.predicate("draft remains file-readable", rawDraft.ok);
  for (source of [
    "",
    "##",
    "## Empty {#empty}",
    "\uFEFF## Bom {#bom}\rbody\r",
  ]) {
    const result = await provider({
      operation: "read_file_without_annotations",
      file,
      detail: true,
    });
    if (!result.ok || !("content" in result.data))
      throw new Error("Expected boundary content.");
    TestValidator.equals("boundary bytes", result.data.content, source);
  }
};
