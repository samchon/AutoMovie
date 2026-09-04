/**
 * Canonical managed-block delimiters for script and screenplay indexes.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Separates generated links from authoritative unit prose.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Gives the derived index one stable replaceable boundary.
 */
export const AUTO_MOVIE_DELIVERY_TOC_START = "<!-- automovie:toc:start -->";
export const AUTO_MOVIE_DELIVERY_TOC_END = "<!-- automovie:toc:end -->";

/**
 * Canonical delivery index bytes and their read-only freshness result.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Reports index drift without turning the index into a second prose owner.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Returns the same rendering to generation and check modes.
 */
export interface IAutoMovieDeliveryTocResult {
  changed: boolean;
  diagnostics: readonly string[];
  source: string;
}

const heading = (source: string, path: string): string => {
  const matches = [...source.matchAll(/^#(?!#)\s+(\S.*)$/gmu)];
  if (matches.length !== 1)
    throw new Error(`${path} must contain exactly one H1 title.`);
  return matches[0]![1]!.trim();
};

/**
 * Render or inspect one delivery-group index from its numbered unit files.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Keeps the index a stable link owner rather than a second screenplay.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Derives ordered index links from authoritative unit identities.
 */
export const planAutoMovieDeliveryToc = (props: {
  check?: boolean;
  indexPath: string;
  indexSource: string;
  units: readonly { path: string; source: string }[];
}): IAutoMovieDeliveryTocResult => {
  const h1 = heading(props.indexSource, props.indexPath);
  const units = [...props.units].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  const seen = new Set<string>();
  for (const unit of units) {
    if (seen.has(unit.path))
      throw new Error(`Delivery inventory repeats ${unit.path}.`);
    seen.add(unit.path);
  }
  const block = [
    AUTO_MOVIE_DELIVERY_TOC_START,
    ...units.map(
      (unit) => `- [${heading(unit.source, unit.path)}](./${unit.path})`,
    ),
    AUTO_MOVIE_DELIVERY_TOC_END,
  ].join("\n");
  const pattern =
    /<!-- automovie:toc:start -->[\s\S]*?<!-- automovie:toc:end -->/gu;
  const matches = [...props.indexSource.matchAll(pattern)];
  if (matches.length > 1)
    throw new Error(
      `${props.indexPath} contains duplicate managed TOC blocks.`,
    );
  if (
    props.indexSource.includes(AUTO_MOVIE_DELIVERY_TOC_START) !==
      props.indexSource.includes(AUTO_MOVIE_DELIVERY_TOC_END) ||
    (matches.length === 0 &&
      (props.indexSource.includes(AUTO_MOVIE_DELIVERY_TOC_START) ||
        props.indexSource.includes(AUTO_MOVIE_DELIVERY_TOC_END)))
  )
    throw new Error(
      `${props.indexPath} contains a malformed managed TOC block.`,
    );
  const canonical = `${AUTO_MOVIE_DELIVERY_TOC_START}\n${block.slice(AUTO_MOVIE_DELIVERY_TOC_START.length + 1)}`;
  const source =
    matches.length === 0
      ? `${props.indexSource.trimEnd()}\n\n${canonical}\n`
      : props.indexSource.replace(pattern, canonical);
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
    source: changed && props.check === true ? props.indexSource : source,
  });
};
