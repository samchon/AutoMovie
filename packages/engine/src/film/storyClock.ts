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
 * The edit places a shot in the presentation; this places the same shot in the
 * story. Two shots may overlap here while sitting far apart in the cut, which
 * is exactly the fact a cut list cannot express.
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
 * The verdict is deliberately refusable. An unpinned shot, a missing
 * realization, or a story time that overflows leaves an operand unresolved, and
 * an unresolved operand fails rather than being skipped, because a claim nobody
 * can measure is not a claim that holds. The summary names which operand it was
 * so the failure is actionable without a second query.
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
  const entries = props.events.map((entry) => {
    const realized = props.realized(entry.shot, entry.event);
    const localSeconds =
      realized === null || Number.isFinite(realized) === false ? null : realized;
    const pin = props.pin(entry.shot);
    const mapped =
      localSeconds === null || pin === null
        ? null
        : autoMovieStoryTime(pin, localSeconds);
    const storySeconds =
      mapped === null || Number.isFinite(mapped) === false ? null : mapped;
    return {
      point: {
        shot: entry.shot,
        event: entry.event,
        localSeconds,
        storySeconds,
      } satisfies IAutoMovieStorySyncPoint,
      reason:
        storySeconds !== null
          ? null
          : localSeconds === null
            ? "that shot has no compiled realization for it"
            : pin === null
              ? "that shot is not pinned to the production story clock"
              : "its pinned story time is not a finite number",
    };
  });
  const points = entries.map((entry) => entry.point);
  const unresolved = entries.find((entry) => entry.reason !== null);
  if (unresolved !== undefined)
    return {
      points,
      spreadSeconds: null,
      toleranceSeconds: props.toleranceSeconds,
      passed: false,
      summary: `event "${unresolved.point.event}" of shot "${unresolved.point.shot}" has no story time: ${unresolved.reason}.`,
    };
  const first = points[0];
  if (first === undefined)
    return {
      points,
      spreadSeconds: null,
      toleranceSeconds: props.toleranceSeconds,
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
    points,
    spreadSeconds,
    toleranceSeconds: props.toleranceSeconds,
    passed,
    summary: `event "${earliest.event}" of shot "${earliest.shot}" at story ${earliest.storySeconds}s and event "${latest.event}" of shot "${latest.shot}" at story ${latest.storySeconds}s are ${spreadSeconds}s apart, ${
      passed ? "within" : "beyond"
    } the ${props.toleranceSeconds}s tolerance.`,
  };
};
