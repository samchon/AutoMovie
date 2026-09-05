import { parseAutoMovieEvidenceMarkdownHeadings } from "./parseAutoMovieEvidenceMarkdown";

/**
 * Opening delimiter of the canonical script and screenplay index link block.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Separates generated links from authoritative unit prose.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Gives the derived index one stable replaceable boundary.
 */
export const AUTO_MOVIE_DELIVERY_TOC_START = "<!-- automovie:toc:start -->";

/**
 * Closing delimiter paired with {@link AUTO_MOVIE_DELIVERY_TOC_START}.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Closes the generated link region without absorbing authoritative unit prose.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Makes malformed or duplicate managed boundaries observable.
 */
export const AUTO_MOVIE_DELIVERY_TOC_END = "<!-- automovie:toc:end -->";

/**
 * Canonical delivery index bytes and their read-only freshness result.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Reports index drift without turning the index into a second prose owner.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Returns the same rendering to generation and check modes.
 */
export interface IAutoMovieDeliveryTocResult {
  /**
   * Whether the supplied index differs from the canonical rendered bytes.
   *
   * @evidence requirements/story/delivery-index.md#story-delivery-index Exposes delivery-index drift to check mode.
   * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Compares the observed index with the generated link block.
   */
  changed: boolean;
  /**
   * Read-only freshness diagnostics; empty when the index is current.
   *
   * @evidence requirements/story/delivery-index.md#story-delivery-index Refuses missing, stale, or misordered delivery links.
   * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Preserves check-mode refusal separately from canonical bytes.
   */
  diagnostics: readonly string[];
  /**
   * Canonical index bytes in both generation and check modes.
   *
   * @evidence requirements/story/delivery-index.md#story-delivery-index Keeps generation and freshness inspection on one rendering.
   * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Returns byte-identical output for the same ordered unit inventory.
   */
  source: string;
}

/**
 * The single visible H1 of one unit or index. The heading parser blanks HTML
 * comments and fenced code, so a title can never carry a managed delimiter;
 * the raw delimiter count is judged separately by the managed-block check.
 */
const h1 = (source: string, path: string): { line: number; title: string } => {
  const headings = parseAutoMovieEvidenceMarkdownHeadings(source);
  const titles = headings.filter((candidate) => candidate.depth === 1);
  if (titles.length !== 1 || headings[0]?.depth !== 1)
    throw new Error(`${path} must contain exactly one H1 title.`);
  return { line: titles[0]!.line, title: titles[0]!.title.trim() };
};

const markdownLinkLabel = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");

const occurrences = (source: string, value: string): number =>
  source.split(value).length - 1;

const unitPath = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;

const withoutManagedBlock = (
  indexSource: string,
  indexPath: string,
): string => {
  const startCount = occurrences(indexSource, AUTO_MOVIE_DELIVERY_TOC_START);
  const endCount = occurrences(indexSource, AUTO_MOVIE_DELIVERY_TOC_END);
  if (startCount > 1 || endCount > 1)
    throw new Error(`${indexPath} contains duplicate managed TOC delimiters.`);
  if (startCount !== endCount)
    throw new Error(`${indexPath} contains a malformed managed TOC block.`);
  if (startCount === 0) return indexSource;
  const match =
    /<!-- automovie:toc:start -->[\s\S]*?<!-- automovie:toc:end -->/u.exec(
      indexSource,
    );
  if (match === null)
    throw new Error(`${indexPath} contains a malformed managed TOC block.`);
  return `${indexSource.slice(0, match.index)}${indexSource.slice(match.index + match[0].length)}`;
};

/**
 * The raw H1 line of one index whose only other content is whitespace and at
 * most one well-formed managed block.
 */
const indexTitleLine = (indexSource: string, indexPath: string): string => {
  const rest = withoutManagedBlock(indexSource, indexPath);
  const lines = rest.split(/\r?\n/u);
  const title = lines[h1(rest, indexPath).line - 1]!;
  if (lines.some((line) => line !== title && line.trim().length !== 0))
    throw new Error(
      `${indexPath} may contain only its H1 title and generated unit links.`,
    );
  return title;
};

/**
 * Render or inspect one delivery-group index from its numbered unit files.
 *
 * The canonical index is the authored H1 line, one blank line, and the managed
 * link block in unit filename order; check and write compare and emit those
 * same bytes.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Keeps the index a stable link owner rather than a second screenplay.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Derives ordered index links from authoritative unit identities and refuses authored body outside the H1 and delimiters.
 */
export const planAutoMovieDeliveryToc = (props: {
  check?: boolean;
  indexPath: string;
  indexSource: string;
  units: readonly { path: string; source: string }[];
}): IAutoMovieDeliveryTocResult => {
  const title = indexTitleLine(props.indexSource, props.indexPath);
  const units = [...props.units].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  const seen = new Set<string>();
  for (const unit of units) {
    if (!unitPath.test(unit.path))
      throw new Error(`Delivery inventory has invalid unit path ${unit.path}.`);
    if (seen.has(unit.path))
      throw new Error(`Delivery inventory repeats ${unit.path}.`);
    seen.add(unit.path);
  }
  const block = [
    AUTO_MOVIE_DELIVERY_TOC_START,
    ...units.map(
      (unit) =>
        `- [${markdownLinkLabel(h1(unit.source, unit.path).title)}](./${unit.path})`,
    ),
    AUTO_MOVIE_DELIVERY_TOC_END,
  ].join("\n");
  const source = `${title}\n\n${block}\n`;
  const changed = source !== props.indexSource;
  return Object.freeze({
    changed,
    diagnostics: Object.freeze(
      changed && props.check === true
        ? [
            `${props.indexPath} has a missing, stale, or misordered delivery TOC.`,
          ]
        : [],
    ),
    source,
  });
};
