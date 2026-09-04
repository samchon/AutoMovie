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

const heading = (
  source: string,
  path: string,
  index: boolean = false,
): string => {
  const headings = parseAutoMovieEvidenceMarkdownHeadings(source);
  const h1 = headings.filter((candidate) => candidate.depth === 1);
  if (h1.length !== 1 || headings[0]?.depth !== 1)
    throw new Error(`${path} must contain exactly one H1 title.`);
  if (index && headings.length !== 1)
    throw new Error(
      `${path} may contain only its H1 and generated unit links.`,
    );
  const title = h1[0]!.title.trim();
  if (
    title.length === 0 ||
    title.includes(AUTO_MOVIE_DELIVERY_TOC_START) ||
    title.includes(AUTO_MOVIE_DELIVERY_TOC_END)
  )
    throw new Error(`${path} has an invalid H1 title.`);
  return title;
};

const markdownLinkLabel = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");

const occurrences = (source: string, value: string): number =>
  source.split(value).length - 1;

const unitPath = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;

const assertManagedBlock = (
  indexSource: string,
  indexPath: string,
): RegExpMatchArray | undefined => {
  const startCount = occurrences(indexSource, AUTO_MOVIE_DELIVERY_TOC_START);
  const endCount = occurrences(indexSource, AUTO_MOVIE_DELIVERY_TOC_END);
  if (startCount > 1 || endCount > 1)
    throw new Error(`${indexPath} contains duplicate managed TOC delimiters.`);
  if (startCount !== endCount)
    throw new Error(`${indexPath} contains a malformed managed TOC block.`);
  if (startCount === 0) return undefined;
  const match =
    /<!-- automovie:toc:start -->[\s\S]*?<!-- automovie:toc:end -->/u.exec(
      indexSource,
    );
  if (match === null)
    throw new Error(`${indexPath} contains a malformed managed TOC block.`);
  return match;
};

const appendManagedBlock = (indexSource: string, block: string): string => {
  const separator = indexSource.endsWith("\n\n")
    ? ""
    : indexSource.endsWith("\n")
      ? "\n"
      : "\n\n";
  return `${indexSource}${separator}${block}\n`;
};

const assertNoUnmanagedDeliveryLink = (
  indexSource: string,
  indexPath: string,
  managed: RegExpMatchArray | undefined,
): void => {
  const outside =
    managed === undefined
      ? indexSource
      : `${indexSource.slice(0, managed.index!)}${indexSource.slice(managed.index! + managed[0].length)}`;
  if (/^\s*-\s+\[[^\n]*\]\([^\n)]+\)\s*$/mu.test(outside))
    throw new Error(
      `${indexPath} contains a delivery link outside its managed TOC block.`,
    );
};

/**
 * Render or inspect one delivery-group index from its numbered unit files.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Keeps the index a stable link owner rather than a second screenplay.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Derives ordered index links from authoritative unit identities.
 */
export const planAutoMovieDeliveryToc = (props: {
  check?: boolean;
  indexPath: string;
  indexSource: string;
  units: readonly { path: string; source: string }[];
}): IAutoMovieDeliveryTocResult => {
  heading(props.indexSource, props.indexPath, true);
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
        `- [${markdownLinkLabel(heading(unit.source, unit.path))}](./${unit.path})`,
    ),
    AUTO_MOVIE_DELIVERY_TOC_END,
  ].join("\n");
  const managed = assertManagedBlock(props.indexSource, props.indexPath);
  assertNoUnmanagedDeliveryLink(props.indexSource, props.indexPath, managed);
  const source =
    managed === undefined
      ? appendManagedBlock(props.indexSource, block)
      : `${props.indexSource.slice(0, managed.index!)}${block}${props.indexSource.slice(managed.index! + managed[0].length)}`;
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
