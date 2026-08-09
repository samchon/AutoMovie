import {
  IAutoMovieShotStoryTime,
  IAutoMovieStorySyncOutcome,
  IAutoMovieStorySyncPoint,
} from "@automovie/interface";

/**
 * Map one shot-local time in seconds onto the production story clock.
 *
 * The map is affine, so a shot that stretches or compresses time still lands on
 * the same clock as one that does not, and the inverse question — which shot
 * covers a given story moment — stays answerable.
 */
export const autoMovieStoryTime = (
  pin: IAutoMovieShotStoryTime,
  localSeconds: number,
): number => pin.originSeconds + localSeconds * (pin.rate ?? 1);

/**
 * Story-clock interval a whole pinned shot occupies, in seconds.
 *
 * The edit places a shot; this places the same shot in the story. Two shots may
 * overlap here while sitting far apart in the cut, which is exactly the fact a
 * cut list cannot express.
 */
export const autoMovieStoryInterval = (
  pin: IAutoMovieShotStoryTime,
  durationSeconds: number,
): { from: number; to: number } => ({
  from: autoMovieStoryTime(pin, 0),
  to: autoMovieStoryTime(pin, durationSeconds),
});

/**
 * Measure one cross-shot simultaneity claim on the production story clock.
 *
 * Each addressed event is taken at its realized shot-local time, mapped through
 * its own shot's pin, and the widest gap between any two resulting story times
 * is compared against the tolerance. Nothing here consults the edit: two shots
 * cut minutes apart pass when their pins put the events together, and two
 * adjacent shots fail when their pins do not.
 *
 * The verdict is deliberately refusable. An unpinned shot or a missing
 * realization leaves an operand unresolved, and an unresolved operand fails
 * rather than being skipped, because a claim nobody can measure is not a claim
 * that holds.
 */
export const evaluateAutoMovieStorySync = (props: {
  /** Addressed shot-and-event pairs in their declared order. */
  events: ReadonlyArray<{ shot: string; event: string }>;
  /** Finite non-negative tolerance in story seconds. */
  toleranceSeconds: number;
  /** Story-clock pin of one shot, or null when that shot carries none. */
  pin: (shot: string) => IAutoMovieShotStoryTime | null;
  /** Realized shot-local event time in seconds, or null when unavailable. */
  realized: (shot: string, event: string) => number | null;
}): IAutoMovieStorySyncOutcome => {
  const points: IAutoMovieStorySyncPoint[] = props.events.map((entry) => {
    const realized = props.realized(entry.shot, entry.event);
    const localSeconds =
      realized === null || Number.isFinite(realized) === false ? null : realized;
    const pin = props.pin(entry.shot);
    const storySeconds =
      localSeconds === null || pin === null
        ? null
        : autoMovieStoryTime(pin, localSeconds);
    return {
      shot: entry.shot,
      event: entry.event,
      localSeconds,
      storySeconds:
        storySeconds === null || Number.isFinite(storySeconds) === false
          ? null
          : storySeconds,
    };
  });
  const base: Pick<
    IAutoMovieStorySyncOutcome,
    "points" | "toleranceSeconds"
  > = {
    points,
    toleranceSeconds: props.toleranceSeconds,
  };
  const unresolved = points.find((point) => point.storySeconds === null);
  if (unresolved !== undefined)
    return {
      ...base,
      spreadSeconds: null,
      passed: false,
      summary: `event "${unresolved.event}" of shot "${unresolved.shot}" has no story time: ${
        unresolved.localSeconds === null
          ? "that shot has no compiled realization for it"
          : "that shot is not pinned to the production story clock"
      }.`,
    };
  const first = points[0];
  if (first === undefined)
    return {
      ...base,
      spreadSeconds: null,
      passed: false,
      summary:
        "no event was addressed, so there is no moment to compare on the story clock.",
    };
  let earliest = first;
  let latest = first;
  for (const point of points) {
    if (point.storySeconds! < earliest.storySeconds!) earliest = point;
    // Ties move the later operand forward so an exactly simultaneous claim
    // still names two distinct events instead of quoting one of them twice.
    if (point.storySeconds! >= latest.storySeconds!) latest = point;
  }
  const spreadSeconds = latest.storySeconds! - earliest.storySeconds!;
  const passed = spreadSeconds <= props.toleranceSeconds;
  return {
    ...base,
    spreadSeconds,
    passed,
    summary: `event "${earliest.event}" of shot "${earliest.shot}" at story ${earliest.storySeconds}s and event "${latest.event}" of shot "${latest.shot}" at story ${latest.storySeconds}s are ${spreadSeconds}s apart, ${
      passed ? "within" : "beyond"
    } the ${props.toleranceSeconds}s tolerance.`,
  };
};
