import assert from "node:assert/strict";

import {
  parseAutoMovieEvidenceSyntax,
  projectAutoMovieAuthoredMarkdown,
  projectAutoMovieMarkdownSyntax,
} from "../src/parseAutoMovieEvidenceSyntax";

/**
 * Native evidence syntax separates carriers, visible prose, and authored body.
 *
 * Scenarios:
 *
 * 1. Live inline and multiline Markdown comments retain heading and line hosts.
 * 2. Mixed or short fence closers, fenced comments, and indented code never
 *    become a carrier or visible target scope.
 * 3. TypeScript JSDoc joins wrapped reasons while strings, templates, line
 *    comments, and ordinary block comments remain inert.
 * 4. Authored-body projection removes evidence-only comments but preserves a
 *    general HTML comment byte for byte.
 */
const markdown = [
  "# Contract",
  "",
  "    <!-- @evidence contracts/a.md#one indented -->",
  "````md",
  "<!-- @evidence contracts/a.md#one fenced -->",
  "```",
  "~~~",
  "````",
  "",
  "## Live {#live}",
  "",
  "<!-- @evidence contracts/a.md#one live answer -->",
  "<!--",
  "@evidenceReview contracts/a.md#one #abcdef0 inspected live owner",
  "-->",
  "",
  "Visible scope.",
].join("\n");
const projection = projectAutoMovieMarkdownSyntax({
  path: "docs/contracts/example.md",
  source: markdown,
});
assert.deepEqual(
  projection.annotations.map((entry) => ({
    host: entry.host,
    line: entry.line,
    text: entry.text,
  })),
  [
    {
      host: "docs/contracts/example.md#live",
      line: 12,
      text: "@evidence contracts/a.md#one live answer",
    },
    {
      host: "docs/contracts/example.md#live",
      line: 14,
      text: "@evidenceReview contracts/a.md#one #abcdef0 inspected live owner",
    },
  ],
);
assert.equal(projection.visibleLines[2], "");
assert.equal(projection.visibleLines[4], "");
assert.equal(projection.visibleLines[16], "Visible scope.");

const adjacentComments = [
  "# Contract",
  "",
  "## Pair {#pair}",
  "before <!--",
  "@evidence contracts/a.md#one first carrier",
  "--> between <!-- @evidence contracts/a.md#two second carrier --> after",
].join("\n");
const adjacentProjection = projectAutoMovieMarkdownSyntax({
  path: "docs/contracts/adjacent.md",
  source: adjacentComments,
});
assert.deepEqual(
  adjacentProjection.annotations.map(({ line, text }) => ({ line, text })),
  [
    { line: 5, text: "@evidence contracts/a.md#one first carrier" },
    { line: 6, text: "@evidence contracts/a.md#two second carrier" },
  ],
);
assert.equal(adjacentProjection.visibleLines[3]?.trim(), "before");
assert.match(
  adjacentProjection.visibleLines[5]?.trim() ?? "",
  /^between\s+after$/u,
);
const unclosed = projectAutoMovieMarkdownSyntax({
  path: "docs/contracts/unclosed.md",
  source: "# Contract\n\n<!-- unclosed\n## Not visible {#hidden}\n",
});
assert.deepEqual(unclosed.annotations, []);
assert.equal(unclosed.visibleLines[3], "");

const typescript = [
  "const raw = '@evidence contracts/a.md#one string';",
  "const template = `@evidence contracts/a.md#one template`;",
  "// @evidence contracts/a.md#one line-comment",
  "/* @evidence contracts/a.md#one ordinary-comment */",
  "/** @evidence contracts/a.md#one local-jsdoc */",
  "const local = true;",
  "/** @evidence contracts/a.md#local-export Locally exported owner. */",
  "const laterExported = true;",
  "/**",
  " * @evidence contracts/a.md#one This declaration owns",
  " * the complete wrapped reason.",
  " * @author Contract Author",
  " */",
  "export const owner = true;",
  "export class PublicOwner {",
  "  /** @evidence contracts/a.md#two Public member. */",
  "  public value = true;",
  "  /** @evidence contracts/a.md#three Private member. */",
  "  private hidden = true;",
  "  /** @evidence contracts/a.md#four Hash-private member. */",
  "  #secret = true;",
  "}",
  "export namespace PublicNamespace {",
  "  /** @evidence contracts/a.md#five Namespace-private member. */",
  "  const hidden = true;",
  "  /** @evidence contracts/a.md#six Namespace export. */",
  "  export const visible = true;",
  "}",
  "/** @evidencePart contracts/a.md#seven::fragment Public fragment. */",
  "export const fragment = true;",
  "export { laterExported };",
].join("\n");
assert.deepEqual(
  parseAutoMovieEvidenceSyntax({ path: "src/owner.ts", source: typescript }),
  [
    {
      host: "src/owner.ts::docblock@7",
      line: 7,
      endLine: 7,
      text: "@evidence contracts/a.md#local-export Locally exported owner.",
    },
    {
      host: "src/owner.ts::docblock@9",
      line: 10,
      endLine: 11,
      text: "@evidence contracts/a.md#one This declaration owns the complete wrapped reason.",
    },
    {
      host: "src/owner.ts::docblock@16",
      line: 16,
      endLine: 16,
      text: "@evidence contracts/a.md#two Public member.",
    },
    {
      host: "src/owner.ts::docblock@26",
      line: 26,
      endLine: 26,
      text: "@evidence contracts/a.md#six Namespace export.",
    },
    {
      host: "src/owner.ts::docblock@29",
      line: 29,
      endLine: 29,
      text: "@evidencePart contracts/a.md#seven::fragment Public fragment.",
    },
  ],
);

const authored = [
  "# Work",
  "",
  "<!-- ordinary author note -->",
  "",
  "<!-- @evidence contracts/a.md#one structural metadata -->",
  "",
  "Body.",
].join("\n");
assert.equal(
  projectAutoMovieAuthoredMarkdown(authored),
  ["# Work", "", "<!-- ordinary author note -->", "", "", "", "Body."].join(
    "\n",
  ),
);
assert.equal(
  projectAutoMovieAuthoredMarkdown(
    "Body.\n<!--\n@evidence contracts/a.md#one wrapped\nreason.\n-->\n",
  ),
  "Body.\n\n",
);
const mixedComment =
  "Body.\n<!--\n@evidence contracts/a.md#one metadata\n\nAuthor note.\n-->\n";
assert.equal(projectAutoMovieAuthoredMarkdown(mixedComment), mixedComment);

process.stdout.write("native evidence syntax passed\n");
