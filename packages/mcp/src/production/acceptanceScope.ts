import type { IAutoMovieAcceptanceScenario } from "@automovie/interface";

/**
 * Every shot an acceptance criterion reads, in declared order without repeats.
 *
 * Frame and event criteria name at most one owning shot. A cross-shot
 * simultaneity criterion names one per addressed event, and every one of them
 * is a real dependency: repinning any of those shots, or changing when its
 * event realizes, changes the verdict. Callers that ask "which shots does this
 * scenario read" must go through here, or a criterion spanning shots will look
 * like a criterion owning none and quietly stop invalidating its reviews.
 */
export const acceptanceCriterionShots = (
  scenario: IAutoMovieAcceptanceScenario,
): string[] => {
  const criterion = scenario.criterion;
  if (criterion.kind === "story-sync")
    return [...new Set(criterion.events.map((entry) => entry.shot))];
  if (criterion.kind === "metric") return [];
  return criterion.shot === undefined ? [] : [criterion.shot];
};

/** Whether one acceptance scenario targets or reads one exact shot. */
export const acceptanceAddressesShot = (
  scenario: IAutoMovieAcceptanceScenario,
  shot: string,
): boolean =>
  (scenario.target.kind === "shot" && scenario.target.id === shot) ||
  acceptanceCriterionShots(scenario).includes(shot);
