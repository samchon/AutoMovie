import type { Nodes, Root } from "mdast";
import { createHash } from "node:crypto";

import type {
  IAutoMovieReferenceContent,
  IAutoMovieReferenceFileIndex,
  IAutoMovieReferenceHeading,
  IAutoMovieReferenceRange,
} from "../structures/IAutoMovieReference";
import { MAX_SOURCE_BYTES, fail } from "./referenceError";

interface Interval {
  /** Inclusive original UTF-16 offset. */
  start: number;
  /** Exclusive original UTF-16 offset. */
  end: number;
}
interface Heading extends IAutoMovieReferenceHeading {
  /** Offset after the selected heading's own final newline. */
  bodyStart: number;
  /** Start of the next same-or-shallower heading, or EOF. */
  subtreeEnd: number;
}
/**
 * The single source snapshot shared by navigation and content projection.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source Keeps revision, syntax and original characters together for one read.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-source Retains the original source plus only positional syntax needed for lossless projection.
 * @author Samchon
 */
export interface ParsedReference {
  /** Fatal UTF-8 decode of the original bytes, including any BOM. */
  source: string;
  /** Canonical project-relative identity associated with these source bytes. */
  file: string;
  /** SHA-256 captured before asynchronous syntax loading can observe mutable input. */
  revision: string;
  /** Original byte count captured beside the source revision. */
  sourceBytes: number;
  /** All top-level headings, including unsupported depths needed for subtree boundaries. */
  headings: Heading[];
  /** Ordered intervals recognized as actual HTML comments, never comment-like code. */
  annotations: Interval[];
  /** Annotation intervals lacking a closing marker, retained only for diagnostics. */
  unterminated: Interval[];
  /** Resolve an original interval into line and UTF-16 coordinates for this snapshot. */
  range(interval: Interval): IAutoMovieReferenceRange;
}

/**
 * Identify exact source bytes or the ordered layer revision declaration.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source Makes changed source discoverable independently of a client's remembered positions.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-source Computes the SHA-256 reference revision without an evidence-review fingerprint.
 */
export const digest = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * Parse syntax through trusted libraries, then select only original offsets.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-selection Finds actual top-level heading identities and hierarchy rather than example headings.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source Recognizes annotation intervals while preserving every non-comment source character.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-selection Derives explicit anchors, unsupported depths, ambiguity and subtree boundaries.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-source Decodes UTF-8 fatally and retains original UTF-16 coordinates and annotation diagnostics.
 */
export async function parseReference(
  file: string,
  bytes: Uint8Array,
  syntax = loadSyntax,
): Promise<ParsedReference> {
  if (bytes.byteLength > MAX_SOURCE_BYTES)
    fail("RESOURCE_LIMIT", "Source exceeds the 8 MiB file limit.");
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return fail("INVALID_UTF8", "Source is not valid UTF-8.");
  }
  const revision = digest(bytes);
  const sourceBytes = bytes.byteLength;
  const { tree, Parser } = await syntax(source).catch(() =>
    fail(
      "PARSER_ERROR",
      "Markdown parsing failed; inspect the canonical source.",
    ),
  );
  const annotations: Interval[] = [];
  const unterminated: Interval[] = [];
  const html: Interval[] = [];
  const visit = (node: Nodes): void => {
    if (node.type === "html") {
      html.push({
        start: node.position!.start.offset!,
        end: node.position!.end.offset!,
      });
    } else if ("children" in node) node.children.forEach(visit);
  };
  visit(tree);
  // Keep HTML context across inline AST nodes while code and escaped text are
  // masked without moving any original UTF-16 offset.
  const htmlParts: string[] = [];
  let htmlCursor = 0;
  for (const interval of html) {
    htmlParts.push(
      " ".repeat(interval.start - htmlCursor),
      source.slice(interval.start, interval.end),
    );
    htmlCursor = interval.end;
  }
  htmlParts.push(" ".repeat(source.length - htmlCursor));
  try {
    const parser = new Parser(
      {
        oncomment() {
          const start = parser.startIndex;
          if (!source.startsWith("<!--", start)) return;
          const end = Math.min(parser.endIndex + 1, source.length);
          const interval = { start, end };
          annotations.push(interval);
          if (source.slice(end - 3, end) !== "-->") unterminated.push(interval);
        },
      },
      { decodeEntities: false },
    );
    parser.end(htmlParts.join(""));
  } catch {
    return fail(
      "PARSER_ERROR",
      "HTML parsing failed; inspect the canonical source.",
    );
  }
  annotations.sort((a, b) => a.start - b.start);
  const lineStarts = [0];
  for (let i = 0; i < source.length; ++i) {
    if (source[i] === "\r") {
      if (source[i + 1] === "\n") ++i;
      lineStarts.push(i + 1);
    } else if (source[i] === "\n") lineStarts.push(i + 1);
  }
  const position = (offset: number) => {
    let low = 0;
    let high = lineStarts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (lineStarts[middle] <= offset) low = middle;
      else high = middle;
    }
    return { offset, line: low + 1, column: offset - lineStarts[low] + 1 };
  };
  const range = (interval: Interval): IAutoMovieReferenceRange => ({
    start: position(interval.start),
    end: position(interval.end),
  });
  const headings: Heading[] = [];
  const ancestry: Heading[] = [];
  for (const node of tree.children) {
    if (node.type !== "heading") continue;
    const start = node.position!.start.offset!;
    const end = node.position!.end.offset!;
    const first = node.children[0];
    const last = node.children[node.children.length - 1];
    const visible =
      first === undefined
        ? ""
        : retain(source, annotations, {
            start: first.position!.start.offset!,
            end: last.position!.end.offset!,
          }).content;
    const anchored = /(?:^|[ \t]+)\{#([^{}\s#]+)\}[ \t]*$/u.exec(visible);
    const anchor = anchored === null ? null : anchored[1];
    while (
      ancestry.length > 0 &&
      ancestry[ancestry.length - 1].depth >= node.depth
    )
      ancestry.pop()!.subtreeEnd = start;
    const parent = ancestry[ancestry.length - 1];
    let bodyStart = end;
    if (source[bodyStart] === "\r") ++bodyStart;
    if (source[bodyStart] === "\n") ++bodyStart;
    const heading: Heading = {
      ordinal: headings.length,
      depth: node.depth,
      title:
        anchored === null
          ? visible
          : visible.slice(0, anchored.index).trimEnd(),
      anchor,
      location: anchor === null ? null : `${file}#${anchor}`,
      addressability: anchor === null ? "unaddressable" : "addressable",
      parent: parent?.ordinal ?? null,
      range: range({ start, end }),
      bodyStart,
      subtreeEnd: source.length,
    };
    headings.push(heading);
    ancestry.push(heading);
  }
  const counts = new Map<string, number>();
  for (const heading of headings)
    if (heading.anchor !== null)
      counts.set(heading.anchor, (counts.get(heading.anchor) ?? 0) + 1);
  for (const heading of headings) {
    if (heading.anchor !== null && counts.get(heading.anchor)! > 1)
      heading.addressability = "ambiguous";
    else if (heading.depth < 2 || heading.depth > 4)
      heading.addressability = "unsupported_depth";
  }
  return {
    source,
    file,
    revision,
    sourceBytes,
    headings,
    annotations,
    unterminated,
    range,
  };
}

async function loadSyntax(source: string) {
  const { fromMarkdown } = await import("mdast-util-from-markdown");
  const { Parser } = await import("htmlparser2");
  const tree: Root = fromMarkdown(source);
  return { tree, Parser };
}

function compact(heading: Heading): IAutoMovieReferenceHeading {
  const { bodyStart: _bodyStart, subtreeEnd: _subtreeEnd, ...index } = heading;
  return index;
}

/**
 * Project a snapshot into compact file navigation without per-comment arrays.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-selection Exposes actual heading order and original title without inventing missing units.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-selection Selects H2/H3/H4 index entries while retaining the optional H1 title.
 */
export function indexReference(
  parsed: ParsedReference,
): IAutoMovieReferenceFileIndex {
  return {
    file: parsed.file,
    revision: parsed.revision,
    sourceBytes: parsed.sourceBytes,
    title:
      parsed.headings.find((heading) => heading.depth === 1)?.title ?? null,
    range: parsed.range({ start: 0, end: parsed.source.length }),
    headings: parsed.headings
      .filter((heading) => heading.depth >= 2 && heading.depth <= 4)
      .map(compact),
    diagnostics: parsed.unterminated.map((interval) => ({
      code: "UNTERMINATED_ANNOTATION",
      range: parsed.range(interval),
    })),
  };
}

/** Return the original pieces outside actual comments, retaining every other character. */
function retain(
  source: string,
  annotations: readonly Interval[],
  interval: Interval,
) {
  let cursor = interval.start;
  const contentRanges: Interval[] = [];
  const annotationRanges: Interval[] = [];
  let low = 0;
  let high = annotations.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (annotations[middle].end <= interval.start) low = middle + 1;
    else high = middle;
  }
  for (
    let index = low;
    index < annotations.length && annotations[index].start < interval.end;
    ++index
  ) {
    const annotation = annotations[index];
    const start = Math.max(annotation.start, interval.start);
    const end = Math.min(annotation.end, interval.end);
    if (cursor < start) contentRanges.push({ start: cursor, end: start });
    annotationRanges.push({ start, end });
    cursor = end;
  }
  if (cursor < interval.end)
    contentRanges.push({ start: cursor, end: interval.end });
  return {
    content: contentRanges
      .map((piece) => source.slice(piece.start, piece.end))
      .join(""),
    contentRanges,
    annotationRanges,
  };
}

/**
 * Select an exact file or heading subtree and return only its original visible pieces.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source Keeps source digest, content and optional reconstruction ranges on the same snapshot.
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-selection Refuses missing, ambiguous or unsupported anchors instead of guessing a nearby section.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-source Rejects stale digests and returns ordered original intervals for detail reads.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-selection Separates selected-heading metadata and ends the body at the next same-or-shallower heading.
 */
export function readReference(
  parsed: ParsedReference,
  options: {
    /** Explicit authored anchor; absent selects the whole file rather than one subtree. */
    anchor?: string;
    /** Source SHA-256 from navigation; a mismatch refuses the current snapshot. */
    expectedDigest?: string;
    /** Include original retained and omitted ranges only when explicitly true. */
    detail?: boolean;
  },
): IAutoMovieReferenceContent {
  if (
    options.expectedDigest !== undefined &&
    options.expectedDigest !== parsed.revision
  )
    fail(
      "STALE_REFERENCE",
      "Source changed; fetch a fresh file index and use its revision.",
    );
  let heading: Heading | null = null;
  if (options.anchor !== undefined) {
    const found = parsed.headings.filter(
      (candidate) => candidate.anchor === options.anchor,
    );
    if (found.length === 0)
      fail(
        "MISSING_SECTION",
        "No heading declares this anchor; fetch the file index.",
      );
    if (found.length > 1)
      fail(
        "AMBIGUOUS_ANCHOR",
        "Multiple headings declare this anchor; inspect the canonical source.",
      );
    heading = found[0];
    if (heading.depth < 2 || heading.depth > 4)
      fail("UNSUPPORTED_DEPTH", "Section reads support only H2, H3 and H4.");
  }
  const interval =
    heading === null
      ? { start: 0, end: parsed.source.length }
      : { start: heading.bodyStart, end: heading.subtreeEnd };
  const projection = retain(parsed.source, parsed.annotations, interval);
  return {
    file: parsed.file,
    revision: parsed.revision,
    sourceBytes: parsed.sourceBytes,
    contentBytes: Buffer.byteLength(projection.content, "utf8"),
    range: parsed.range(interval),
    heading: heading === null ? null : compact(heading),
    content: projection.content,
    diagnostics: parsed.unterminated
      .filter((item) => item.start < interval.end && item.end > interval.start)
      .map((item) => ({
        code: "UNTERMINATED_ANNOTATION",
        range: parsed.range(item),
      })),
    ...(options.detail === true
      ? {
          projection: {
            contentRanges: projection.contentRanges.map(parsed.range),
            annotationRanges: projection.annotationRanges.map(parsed.range),
          },
        }
      : {}),
  };
}
