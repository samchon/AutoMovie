interface IAutoMovieEvidenceMarkdownHeading {
  /** Explicit anchor without the leading hash, when the heading declares one. */
  anchor: string | undefined;
  /** ATX heading depth from one through six. */
  depth: number;
  /** One-based source line. */
  line: number;
  /** Visible title without the trailing explicit anchor. */
  title: string;
}

/**
 * Extract visible ATX headings while ignoring comments and fenced examples.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Prevents commented or example headings from becoming contract and owner identities.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Inventories only visible Markdown headings while preserving their original line addresses.
 * @author Samchon
 */
export const parseAutoMovieEvidenceMarkdownHeadings = (
  source: string,
): IAutoMovieEvidenceMarkdownHeading[] => {
  const output: IAutoMovieEvidenceMarkdownHeading[] = [];
  for (const [index, line] of visibleMarkdownLines(source).entries()) {
    const heading = /^(#{1,6})(?!#)\s+(\S.*)$/u.exec(line);
    if (heading === null) continue;
    const anchored = /[ \t]+\{#([^{}\s]+)\}[ \t]*$/u.exec(heading[2]!);
    output.push({
      anchor: anchored?.[1],
      depth: heading[1]!.length,
      line: index + 1,
      title: heading[2]!.replace(/[ \t]+\{#[^{}\s]+\}[ \t]*$/u, ""),
    });
  }
  return output;
};

/** Blank Markdown comments and fenced code without changing line addresses. */
const visibleMarkdownLines = (source: string): string[] => {
  const output: string[] = [];
  let fence: { character: "`" | "~"; length: number } | undefined;
  let htmlComment = false;
  for (const sourceLine of source.split(/\r?\n/u)) {
    if (fence !== undefined) {
      if (
        new RegExp(
          `^ {0,3}${fence.character}{${fence.length},}[ \\t]*$`,
          "u",
        ).test(sourceLine)
      )
        fence = undefined;
      output.push("");
      continue;
    }
    let line = "";
    for (let cursor = 0; cursor < sourceLine.length; ) {
      if (htmlComment) {
        const close = sourceLine.indexOf("-->", cursor);
        if (close === -1) {
          line += " ".repeat(sourceLine.length - cursor);
          break;
        }
        line += " ".repeat(close + 3 - cursor);
        cursor = close + 3;
        htmlComment = false;
      } else {
        const open = sourceLine.indexOf("<!--", cursor);
        if (open === -1) {
          line += sourceLine.slice(cursor);
          break;
        }
        line += `${sourceLine.slice(cursor, open)}    `;
        cursor = open + 4;
        htmlComment = true;
      }
    }
    const marker = /^ {0,3}(`{3,}|~{3,})/u.exec(line)?.[1];
    if (marker !== undefined) {
      fence = {
        character: marker[0] as "`" | "~",
        length: marker.length,
      };
      output.push("");
      continue;
    }
    output.push(line);
  }
  return output;
};
