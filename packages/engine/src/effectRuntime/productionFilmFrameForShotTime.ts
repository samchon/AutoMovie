import { IAutoMovieProductionFrameRate } from "@automovie/interface";

import { productionFrameBoundaryToSeconds } from "../film/productionTimebase";
import { IAutoMovieFilmEffectClock } from "./IAutoMovieFilmEffectClock";
import { estimateProductionFilmFrame } from "./estimateProductionFilmFrame";
import { productionFilmEffectTimelineFrameRate } from "./productionFilmEffectTimelineFrameRate";

/**
 * Map one shot-local review time to its only realized film frame.
 *
 * A shot page and a review capture know a shot and a second, not a film
 * frame. Film-owned state at that second exists only when the edit realizes
 * the shot exactly once at the source frame owning that second, so an absent
 * or repeated occurrence answers `null` rather than choosing one occurrence.
 * The answer depends only on the compiled timeline, never on whether a render
 * has prepared any other runtime.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Resolves a shot-local second to the rational film frame that owns it.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Gives a shot review seek the same film frame the film schedule would sample for that source frame.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Selects the frame whose half-open boundary interval contains the requested second.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Keeps one exact frame-number-to-time relation between shot review and film schedule.
 */
export const productionFilmFrameForShotTime = (props: {
  timeline: IAutoMovieFilmEffectClock;
  shot: string;
  time: number;
}): number | null => {
  const frameRate = productionFilmEffectTimelineFrameRate(props.timeline);
  if (Number.isFinite(props.time) === false || props.time < 0) return null;
  const sourceFrame = lastFrameAtOrBefore(props.time, frameRate);
  if (sourceFrame === null) return null;
  const candidates = props.timeline.segments.filter(
    (segment) =>
      segment.shot === props.shot &&
      sourceFrame >= segment.sourceInFrame &&
      sourceFrame < segment.sourceOutFrame,
  );
  if (candidates.length !== 1) return null;
  const segment = candidates[0]!;
  return segment.startFrame + sourceFrame - segment.sourceInFrame;
};

/**
 * The largest frame whose exact boundary time is at or before a nonnegative
 * finite `seconds`, or `null` when no safe-integer frame can own it.
 */
const lastFrameAtOrBefore = (
  seconds: number,
  frameRate: IAutoMovieProductionFrameRate,
): number | null => {
  let frame = estimateProductionFilmFrame(seconds, frameRate, Math.floor);
  if (frame === null) return null;
  while (
    frame > 0 &&
    productionFrameBoundaryToSeconds({ frame, frameRate }) > seconds
  )
    frame -= 1;
  while (
    productionFrameBoundaryToSeconds({ frame: frame + 1, frameRate }) <= seconds
  )
    frame += 1;
  return frame;
};
