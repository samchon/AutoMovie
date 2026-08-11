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
 *
 * @evidence requirements/story/story-clock-and-state.md#story-absolute-relative-time autoMovieStoryTime applies the shot's origin and rate to preserve a distinct absolute story time independent of edit placement.
 * @evidence requirements/story/story-clock-and-state.md#story-presentation-chronology Maps a shot-local presentation instant through its explicit story origin and rate without treating edit placement as chronology.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-representation autoMovieStoryTime represents the story instant explicitly as `originSeconds + localSeconds × rate`, independent of edit order.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-chronology-presentation Keeps the affine story-time mapping independent of the shot's eventual presentation position.
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
 *
 * @evidence requirements/story/story-clock-and-state.md#story-absolute-relative-time autoMovieStoryInterval maps both shot boundaries through the pin, exposing the absolute story interval the shot occupies.
 * @evidence requirements/story/story-clock-and-state.md#story-presentation-chronology Derives a shot's story interval from its pin rather than from adjacency or placement in the final presentation.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-representation autoMovieStoryInterval maps both local endpoints through the same pin so story overlap remains distinct from editorial adjacency.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-chronology-presentation Preserves an affine chronology interval that may overlap or diverge from the edit's presentation order.
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
 *
 * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Maps every addressed realization through its own shot pin before measuring their common-clock spread.
 * @evidence requirements/story/coverage-and-acceptance.md#story-scene-event-acceptance Evaluates the exact authored shot-and-event operands and preserves an unresolved operand as a deterministic failure.
 * @evidence requirements/story/coverage-and-acceptance.md#story-falsifiable-acceptance Binds the addressed shot-event operands, realized times, story pins, numeric tolerance, and explicit false boundary into one repeatable synchronization criterion.
 * @evidence requirements/story/coverage-and-acceptance.md#story-acceptance-judgment-measurement Reports only resolved story times, numeric spread, and tolerance comparison and does not claim clarity, theme, emotion, or audience judgment.
 * @evidence requirements/story/coverage-and-acceptance.md#story-acceptance-empty-unsupported Returns an explicit false outcome for an empty operand set or any missing, non-finite, or unpinned event instead of treating the unanalyzable remainder as a pass.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization evaluateAutoMovieStorySync compares realized events on the common story clock and preserves the declared synchronization tolerance.
 * @evidence specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-sync-criterion Measures current realized event times against the declared tolerance without substituting frame or renderer identity for the story criterion.
 * @evidence specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-criterion-cases Makes the declared tolerance the exact pass/fail boundary for the explicitly addressed realized story times.
 * @evidence specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-story-human-machine-verdict Limits the automatic verdict to finite story-time arithmetic and leaves qualitative story judgment to its human authority.
 * @evidence specifications/narrative-and-intent/scene-coverage-and-acceptance.md#narrative-intent-coverage-gap-status Preserves empty, missing, unpinned, and non-finite synchronization inputs as deterministic false outcomes rather than a reduced-scope success.
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
      realized === null || Number.isFinite(realized) === false
        ? null
        : realized;
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
