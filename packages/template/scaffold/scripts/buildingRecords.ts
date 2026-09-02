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
 * by id and the staged record wins -- it is the one a frame was actually drawn
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
  return [...union.values()].sort((left, right) =>
    left.environment.id < right.environment.id
      ? -1
      : left.environment.id > right.environment.id
        ? 1
        : 0,
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
