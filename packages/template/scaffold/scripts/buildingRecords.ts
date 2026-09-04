import type { IAutoMovieBuiltEnvironment } from "@automovie/interface";

/**
 * One building this report draws, beside where it came from.
 *
 * The two provenances are not interchangeable to a reviewer. A staged building
 * has frames a delivery review can open; a materialized one has none, and every
 * claim about how it looks rests on the drawings this report derives. Reporting
 * both under one heading would let a reader carry a staged building's evidence
 * over to one nobody has photographed.
 */
export interface IAutoMovieBuildingRecord {
  environment: IAutoMovieBuiltEnvironment;
  source: "materialized" | "staged";
}

/**
 * Staged and materialized buildings together, each id carried once.
 *
 * A production may hold both: a library owner publishes a building and a shot
 * stages the same one to film it. The id is the identity, so the union is taken
 * by id and the staged record wins; it is the one a frame was actually drawn
 * from, and a report that silently preferred the other would describe a
 * building nobody photographed.
 *
 * Split from the command so this can be read without a compiled project on
 * disk. `deriveBuilding.ts` opens project state at module level and refuses
 * unless it is current, so nothing in this project could load it to see which
 * record wins a collision, and the rule that decides it went unread.
 */
export const collectAutoMovieBuildingRecords = (props: {
  materialized: readonly IAutoMovieBuiltEnvironment[];
  staged: readonly IAutoMovieBuiltEnvironment[];
}): IAutoMovieBuildingRecord[] => {
  const union = new Map<string, IAutoMovieBuildingRecord>();
  for (const environment of props.materialized)
    union.set(environment.id, { environment, source: "materialized" });
  for (const environment of props.staged)
    union.set(environment.id, { environment, source: "staged" });
  // Two-way, because the map above is keyed by id: no two records here can
  // share one, so a comparator with an equality arm would carry a branch that
  // no run can take. Unique keys make `<` a total order on its own.
  return [...union.values()].sort((left, right) =>
    left.environment.id < right.environment.id ? -1 : 1,
  );
};

/**
 * The tally a reviewer reads before deciding what a claim may rest on.
 *
 * Said once for the whole run rather than per building, because the thing worth
 * knowing is how many of the drawings in front of you are all the evidence
 * there is.
 */
export const describeAutoMovieBuildingRecords = (
  records: readonly IAutoMovieBuildingRecord[],
): string =>
  `${records.length} building record(s): ${
    records.filter((entry) => entry.source === "staged").length
  } staged by a shot, ${
    records.filter((entry) => entry.source === "materialized").length
  } materialized by a library and photographed by nothing`;

/**
 * Every building a library published, gathered across its design owners.
 *
 * Split from the command for the same reason the union is: `deriveBuilding.ts`
 * opens project state at module level and refuses unless it is current, so
 * nothing could load it to see how an owner is addressed, and the address it
 * passed was wrong for as long as that stood.
 *
 * The address is the owner's full `path#anchor`, which is how the published
 * index is keyed and how every other caller of the reader addresses it. Passing
 * the document path alone matched nothing, every time, in silence.
 *
 * Two owners publishing one building id carry it once. A library owner may name
 * a building another owner also names; the compiler refuses that as duplicate
 * publication at its own address; and a report that drew both would put one
 * sheet on the page twice and double its take-off.
 */
export const collectAutoMovieMaterializedEnvironments = (props: {
  owners: ReadonlyArray<{
    branch: string;
    path: string;
    units: ReadonlyArray<{ anchor: string }>;
  }>;
  resolve: (request: {
    branch: string;
    owner: string;
    anchor: string;
  }) => readonly IAutoMovieBuiltEnvironment[];
}): IAutoMovieBuiltEnvironment[] => {
  const found = new Map<string, IAutoMovieBuiltEnvironment>();
  for (const owner of props.owners)
    for (const unit of owner.units)
      for (const environment of props.resolve({
        branch: owner.branch,
        owner: `${owner.path}#${unit.anchor}`,
        anchor: unit.anchor,
      }))
        found.set(environment.id, environment);
  return [...found.values()];
};

/**
 * The two lines a reviewer reads about one building.
 *
 * Beside {@link describeAutoMovieBuildingRecords}, which says the same thing
 * for the run as a whole. The provenance is repeated per building on purpose:
 * a reader scanning one id must not have to hold the run's tally in their head
 * to know whether frames exist for the building in front of them.
 *
 * A count of gaps is separated from the counts of what was derived, because a
 * gap is a statement about what this report could not do and reads wrongly when
 * queued behind five numbers about what it did.
 */
export const describeAutoMovieBuildingReport = (props: {
  gaps: number;
  id: string;
  networks: number;
  quantitySubjects: number;
  runs: number;
  schedules: ReadonlyArray<{ subject: string; total: number }>;
  sheets: number;
  source: "materialized" | "staged";
}): readonly [string, string] => [
  `${props.id} (${props.source}): ${props.sheets} sheet(s), ${props.schedules
    .map((schedule) => `${schedule.total} ${schedule.subject}(s)`)
    .join(", ")}, ${props.quantitySubjects} quantity subject(s), ${
    props.networks
  } network(s), ${props.runs} analysis run(s)`,
  `${props.id} (${props.source}): ${props.gaps} declared gap(s)`,
];

/**
 * One gap this report declared, in the words a reader acts on.
 *
 * Structurally `IAutoMovieDrawingGap`, restated here so the collapse below can
 * be read without a compiled project: the script that used to own it opens
 * project state at module level and refuses unless it is current.
 */
export interface IAutoMovieDescribableGap {
  status: string;
  subject: string;
  reason: string;
  remedy: string;
}

/**
 * Print each gap once, with its remedy and how many artifacts declared it.
 *
 * Every sheet declares the same three limits of the drawing derivation, so a
 * work of two units prints thirty-six copies of them unless they are collapsed,
 * and the gaps that are actually about this building disappear underneath. The
 * sidecar still carries every row beside the artifact that raised it; this is
 * the reading, and the remedy is half of what a gap is for.
 *
 * Keyed by what the gap says rather than by the artifact it came from. The
 * three constant limits carry identical text on every sheet, while a gap naming
 * this building's own spaces or openings differs and stays its own row. The
 * subject is deliberately outside the key: it is what the first row names, and
 * folding by it would split the constant limits back into one row per sheet,
 * which is the thing being collapsed.
 *
 * First-seen order, not sorted. A reader compares this against the sidecar's
 * own rows, and re-ordering them would make the two listings unalignable.
 */
export const describeAutoMovieBuildingGaps = (
  gaps: readonly IAutoMovieDescribableGap[],
): string[] => {
  const counted = new Map<
    string,
    { gap: IAutoMovieDescribableGap; count: number }
  >();
  for (const gap of gaps) {
    const key = [gap.status, gap.reason, gap.remedy].join(
      String.fromCharCode(0),
    );
    const seen = counted.get(key);
    if (seen === undefined) counted.set(key, { gap, count: 1 });
    else ++seen.count;
  }
  return [...counted.values()].map(
    (entry) =>
      `  ${entry.gap.status} ${entry.gap.subject}${
        entry.count === 1 ? "" : ` (and ${entry.count - 1} more like it)`
      }: ${entry.gap.reason}${String.fromCharCode(10)}    remedy: ${
        entry.gap.remedy
      }`,
  );
};
