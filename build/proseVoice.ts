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

export const AUTOMOVIE_PROSE_VOICE_POPULATION_CATEGORIES = [
  "root-instruction",
  "root-skill",
  "package-readme",
  "scaffold",
] as const;
export type AutoMovieProseVoicePopulationCategory =
  (typeof AUTOMOVIE_PROSE_VOICE_POPULATION_CATEGORIES)[number];

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

interface ISourceLine {
  content: string;
  end: number;
  start: number;
}

interface ISourceRange {
  end: number;
  start: number;
}

type MarkdownContainer =
  | { kind: "blockquote" }
  | { indent: number; kind: "list" };

const EMOJI = new RegExp("\\p{RGI_Emoji}", "gv");
const VOICE_MARKS: ReadonlyArray<{
  kind: AutoMovieProseVoiceViolationKind;
  expression: RegExp;
}> = [
  { kind: "em-dash", expression: /—/gu },
  { kind: "emoji", expression: EMOJI },
  {
    kind: "spaced-double-hyphen",
    expression: /(?<=[ \t])--(?=[ \t]|$)/gmu,
  },
];

/** Classify one path in the stable instruction and scaffold prose population. */
export const autoMovieProseVoicePopulationCategory = (
  relative: string,
): AutoMovieProseVoicePopulationCategory | null => {
  const file = relative.replaceAll("\\", "/");
  if (file === "AGENTS.md" || file === "README.md") return "root-instruction";
  if (/^\.agents\/skills\/[^/]+\/[^/]+\.md$/u.test(file)) return "root-skill";
  if (/^packages\/[^/]+\/README\.md$/u.test(file)) return "package-readme";
  if (/^packages\/template\/scaffold\/.+\.(?:md|[cm]?ts|tsx)$/u.test(file))
    return "scaffold";
  return null;
};

/** Select the stable instruction and scaffold prose population. */
export const isAutoMovieProseVoicePath = (relative: string): boolean =>
  autoMovieProseVoicePopulationCategory(relative) !== null;

const sourceLines = (source: string): ISourceLine[] => {
  const output: ISourceLine[] = [];
  const expression = /[^\r\n]*(?:\r\n|\r|\n|$)/gu;
  for (const match of source.matchAll(expression)) {
    if (match[0].length === 0) continue;
    const ending = /(?:\r\n|\r|\n)$/u.exec(match[0])?.[0].length ?? 0;
    output.push({
      content: match[0].slice(0, match[0].length - ending),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return output;
};

const indentation = (
  line: string,
  start: number,
  limit: number,
): { columns: number; cursor: number } => {
  let columns = 0;
  let cursor = start;
  while (cursor < line.length && columns < limit) {
    if (line[cursor] === " ") {
      columns++;
      cursor++;
    } else if (line[cursor] === "\t") {
      const width = 4 - (columns % 4);
      if (columns + width > limit) break;
      columns += width;
      cursor++;
    } else break;
  }
  return { columns, cursor };
};

const openingContainer = (
  line: string,
): { containers: MarkdownContainer[]; cursor: number } => {
  const containers: MarkdownContainer[] = [];
  let cursor = 0;
  while (cursor < line.length) {
    const leading = indentation(line, cursor, 3);
    const content = leading.cursor;
    if (line[content] === ">") {
      cursor = content + 1;
      if (line[cursor] === " " || line[cursor] === "\t") cursor++;
      containers.push({ kind: "blockquote" });
      continue;
    }
    const marker = /^(?:[*+-]|\d{1,9}[.)])(?=[ \t])/u.exec(
      line.slice(content),
    )?.[0];
    if (marker === undefined) break;
    const afterMarker = content + marker.length;
    const whitespace = indentation(line, afterMarker, 5);
    const contentIndent =
      whitespace.columns > 4 ? 1 : Math.max(1, whitespace.columns);
    const consumed = indentation(line, afterMarker, contentIndent);
    containers.push({
      indent: leading.columns + marker.length + contentIndent,
      kind: "list",
    });
    cursor = consumed.cursor;
  }
  return { containers, cursor };
};

const continuedContainer = (
  line: string,
  containers: readonly MarkdownContainer[],
): number | null => {
  let cursor = 0;
  for (const [index, container] of containers.entries()) {
    if (container.kind === "blockquote") {
      const leading = indentation(line, cursor, 3);
      if (line[leading.cursor] !== ">") return null;
      cursor = leading.cursor + 1;
      if (line[cursor] === " " || line[cursor] === "\t") cursor++;
    } else {
      if (
        line.slice(cursor).trim().length === 0 &&
        containers.slice(index).every((entry) => entry.kind === "list")
      )
        return line.length;
      const leading = indentation(line, cursor, container.indent);
      if (leading.columns < container.indent) return null;
      cursor = leading.cursor;
    }
  }
  return cursor;
};

const openingFence = (
  content: string,
): { character: "`" | "~"; length: number } | null => {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(content);
  if (match === null) return null;
  if (match[1]![0] === "`" && match[2]!.includes("`")) return null;
  return {
    character: match[1]![0] as "`" | "~",
    length: match[1]!.length,
  };
};

const closesFence = (
  content: string,
  fence: { character: "`" | "~"; length: number },
): boolean => {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/u.exec(content);
  return (
    match !== null &&
    match[1]![0] === fence.character &&
    match[1]!.length >= fence.length
  );
};

const markdownFenceRanges = (source: string): ISourceRange[] => {
  const output: ISourceRange[] = [];
  let fence:
    | {
        character: "`" | "~";
        containers: MarkdownContainer[];
        length: number;
        start: number;
      }
    | undefined;
  for (const line of sourceLines(source)) {
    if (fence !== undefined) {
      const cursor = continuedContainer(line.content, fence.containers);
      if (cursor !== null) {
        if (closesFence(line.content.slice(cursor), fence)) {
          output.push({ start: fence.start, end: line.end });
          fence = undefined;
        }
        continue;
      }
      output.push({ start: fence.start, end: line.start });
      fence = undefined;
    }
    const container = openingContainer(line.content);
    const opened = openingFence(line.content.slice(container.cursor));
    if (opened !== null)
      fence = {
        ...opened,
        containers: container.containers,
        start: line.start,
      };
  }
  if (fence !== undefined)
    output.push({ start: fence.start, end: source.length });
  return output;
};

const isEscaped = (source: string, offset: number): boolean => {
  let slashes = 0;
  for (
    let cursor = offset - 1;
    cursor >= 0 && source[cursor] === "\\";
    cursor--
  )
    slashes++;
  return slashes % 2 === 1;
};

const markdownCodeSpanRanges = (
  source: string,
  available: ISourceRange,
): ISourceRange[] => {
  const output: ISourceRange[] = [];
  let cursor = available.start;
  while (cursor < available.end) {
    const opener = source.indexOf("`", cursor);
    if (opener === -1 || opener >= available.end) break;
    let openerEnd = opener + 1;
    while (openerEnd < available.end && source[openerEnd] === "`") openerEnd++;
    if (isEscaped(source, opener)) {
      cursor = openerEnd;
      continue;
    }
    const length = openerEnd - opener;
    let candidate = openerEnd;
    let closer = -1;
    while (candidate < available.end) {
      candidate = source.indexOf("`", candidate);
      if (candidate === -1 || candidate >= available.end) break;
      let candidateEnd = candidate + 1;
      while (candidateEnd < available.end && source[candidateEnd] === "`")
        candidateEnd++;
      if (candidateEnd - candidate === length) {
        closer = candidateEnd;
        break;
      }
      candidate = candidateEnd;
    }
    if (closer === -1) cursor = openerEnd;
    else {
      output.push({ start: opener, end: closer });
      cursor = closer;
    }
  }
  return output;
};

const mergeRanges = (ranges: readonly ISourceRange[]): ISourceRange[] => {
  const output: ISourceRange[] = [];
  for (const range of [...ranges].sort(
    (left, right) => left.start - right.start,
  )) {
    const previous = output.at(-1);
    if (previous === undefined || previous.end < range.start)
      output.push({ ...range });
    else previous.end = Math.max(previous.end, range.end);
  }
  return output;
};

/** Return Markdown prose while excluding CommonMark fences and code spans. */
const markdownProse = (source: string): IProseSlice[] => {
  const fences = markdownFenceRanges(source);
  const codeSpans: ISourceRange[] = [];
  let cursor = 0;
  for (const fence of fences) {
    codeSpans.push(
      ...markdownCodeSpanRanges(source, { start: cursor, end: fence.start }),
    );
    cursor = fence.end;
  }
  codeSpans.push(
    ...markdownCodeSpanRanges(source, { start: cursor, end: source.length }),
  );
  const excluded = mergeRanges([...fences, ...codeSpans]);
  const output: IProseSlice[] = [];
  cursor = 0;
  for (const range of excluded) {
    if (cursor < range.start)
      output.push({ offset: cursor, text: source.slice(cursor, range.start) });
    cursor = range.end;
  }
  if (cursor < source.length)
    output.push({ offset: cursor, text: source.slice(cursor) });
  return output;
};

/** Return only TypeScript comments; literals and executable tokens stay out. */
const typeScriptCommentProse = (
  file: string,
  source: string,
): IProseSlice[] => {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.toLowerCase().endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
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
  let line = 1;
  let column = 1;
  for (let cursor = 0; cursor < offset; cursor++) {
    if (source[cursor] === "\r") {
      if (source[cursor + 1] === "\n" && cursor + 1 < offset) cursor++;
      line++;
      column = 1;
    } else if (source[cursor] === "\n") {
      line++;
      column = 1;
    } else column++;
  }
  return { line, column };
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
      : [".cts", ".mts", ".ts", ".tsx"].includes(extension)
        ? typeScriptCommentProse(props.file, props.source)
        : [];
  const forbidden = (kind: AutoMovieProseVoiceViolationKind): boolean =>
    kind === "em-dash"
      ? props.rule.emDash === "forbid"
      : kind === "emoji"
        ? props.rule.emoji === "forbid"
        : props.rule.spacedDoubleHyphen === "forbid";
  return slices
    .flatMap((slice) =>
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
    )
    .sort((left, right) => left.offset - right.offset);
};
