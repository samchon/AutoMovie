import path from "node:path";
import ts from "typescript-compiler";

export type AutoMovieProseVoiceViolationKind =
  | "emoji"
  | "em-dash"
  | "spaced-double-hyphen";

export interface IAutoMovieProseVoiceViolation {
  file: string;
  kind: AutoMovieProseVoiceViolationKind;
  offset: number;
  line: number;
  column: number;
  text: string;
}

export interface IAutoMovieProseVoiceRule {
  emDash: "allow" | "forbid";
  emoji: "allow" | "forbid";
  spacedDoubleHyphen: "allow" | "forbid";
}

/** Machine-readable form of the documentation skill's normative voice rule. */
export const AUTOMOVIE_PROSE_VOICE_RULE: IAutoMovieProseVoiceRule = {
  emDash: "forbid",
  emoji: "forbid",
  spacedDoubleHyphen: "forbid",
};

interface IProseSlice {
  offset: number;
  text: string;
}

const MARKDOWN_FENCE = /^( {0,3})(`{3,}|~{3,})/u;
const EMOJI = /\p{Extended_Pictographic}/gu;
const VOICE_MARKS: ReadonlyArray<{
  kind: AutoMovieProseVoiceViolationKind;
  expression: RegExp;
}> = [
  { kind: "em-dash", expression: /[ \t]*—/gu },
  { kind: "emoji", expression: EMOJI },
  {
    kind: "spaced-double-hyphen",
    expression: /[ \t]+--(?=[ \t]|$)/gmu,
  },
];

/** Select the stable instruction and scaffold prose population. */
export const isAutoMovieProseVoicePath = (relative: string): boolean => {
  const file = relative.replaceAll("\\", "/");
  return (
    file === "AGENTS.md" ||
    file === "README.md" ||
    /^\.agents\/skills\/[^/]+\/[^/]+\.md$/u.test(file) ||
    /^packages\/[^/]+\/README\.md$/u.test(file) ||
    /^packages\/template\/scaffold\/.+\.(?:md|ts)$/u.test(file)
  );
};

/** Return Markdown prose while excluding fenced blocks and closed code spans. */
const markdownProse = (source: string): IProseSlice[] => {
  const output: IProseSlice[] = [];
  let offset = 0;
  let fence: { marker: "`" | "~"; length: number } | null = null;
  for (const line of source.match(/.*(?:\n|$)/gu) ?? []) {
    if (line.length === 0) continue;
    const fenceMatch = line.match(MARKDOWN_FENCE);
    if (fence !== null) {
      if (
        fenceMatch !== null &&
        fenceMatch[2]![0] === fence.marker &&
        fenceMatch[2]!.length >= fence.length
      )
        fence = null;
      offset += line.length;
      continue;
    }
    if (fenceMatch !== null) {
      fence = {
        marker: fenceMatch[2]![0] as "`" | "~",
        length: fenceMatch[2]!.length,
      };
      offset += line.length;
      continue;
    }

    let cursor = 0;
    while (cursor < line.length) {
      const opener = line.indexOf("`", cursor);
      if (opener === -1) {
        output.push({ offset: offset + cursor, text: line.slice(cursor) });
        break;
      }
      let runEnd = opener + 1;
      while (line[runEnd] === "`") runEnd += 1;
      const marker = "`".repeat(runEnd - opener);
      const closer = line.indexOf(marker, runEnd);
      if (closer === -1) {
        output.push({ offset: offset + cursor, text: line.slice(cursor) });
        break;
      }
      if (opener > cursor)
        output.push({
          offset: offset + cursor,
          text: line.slice(cursor, opener),
        });
      cursor = closer + marker.length;
    }
    offset += line.length;
  }
  return output;
};

/** Return only TypeScript comments; literals and executable tokens stay out. */
const typeScriptCommentProse = (source: string): IProseSlice[] => {
  const sourceFile = ts.createSourceFile(
    "prose.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const ranges = new Map<number, ts.CommentRange>();
  const collect = (comments: readonly ts.CommentRange[] | undefined): void => {
    for (const comment of comments ?? []) ranges.set(comment.pos, comment);
  };
  const visit = (node: ts.Node): void => {
    collect(ts.getLeadingCommentRanges(source, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(source, node.end));
    ts.forEachChild(node, visit);
  };
  collect(ts.getLeadingCommentRanges(source, 0));
  visit(sourceFile);
  collect(ts.getTrailingCommentRanges(source, sourceFile.end));
  return [...ranges.values()]
    .sort((left, right) => left.pos - right.pos)
    .map((range) => ({
      offset: range.pos,
      text: source.slice(range.pos, range.end),
    }));
};

const lineAndColumn = (
  source: string,
  offset: number,
): { line: number; column: number } => {
  const prefix = source.slice(0, offset);
  const lines = prefix.split("\n");
  return { line: lines.length, column: lines.at(-1)!.length + 1 };
};

/** Inspect one Markdown document or the comments of one TypeScript module. */
export const inspectAutoMovieProseVoice = (props: {
  file: string;
  rule: IAutoMovieProseVoiceRule;
  source: string;
}): IAutoMovieProseVoiceViolation[] => {
  const extension = path.extname(props.file).toLowerCase();
  const slices =
    extension === ".md"
      ? markdownProse(props.source)
      : extension === ".ts"
        ? typeScriptCommentProse(props.source)
        : [];
  const forbidden = (kind: AutoMovieProseVoiceViolationKind): boolean =>
    kind === "em-dash"
      ? props.rule.emDash === "forbid"
      : kind === "emoji"
        ? props.rule.emoji === "forbid"
        : props.rule.spacedDoubleHyphen === "forbid";
  return slices.flatMap((slice) =>
    VOICE_MARKS.filter(({ kind }) => forbidden(kind)).flatMap(
      ({ expression, kind }) => {
        expression.lastIndex = 0;
        return [...slice.text.matchAll(expression)].map((match) => {
          const location = lineAndColumn(
            props.source,
            slice.offset + match.index,
          );
          return {
            file: props.file.replaceAll("\\", "/"),
            kind,
            offset: slice.offset + match.index,
            ...location,
            text: match[0],
          };
        });
      },
    ),
  );
};

/** Repair only marks already classified as prose by the same lexer. */
export const repairAutoMovieProseVoice = (props: {
  file: string;
  rule: IAutoMovieProseVoiceRule;
  source: string;
}): string => {
  let output = props.source;
  const violations = inspectAutoMovieProseVoice(props).sort(
    (left, right) => right.offset - left.offset,
  );
  for (const violation of violations) {
    const replacement = violation.kind === "emoji" ? "" : ";";
    output =
      output.slice(0, violation.offset) +
      replacement +
      output.slice(violation.offset + violation.text.length);
  }
  return output;
};
