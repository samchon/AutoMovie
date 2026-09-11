import { IAutoMovieFilmTimeline } from "@automovie/interface";

import { IAutoMovieProductionRenderFrame } from "./IAutoMovieProductionRenderFrame";
import { IAutoMovieProductionRenderLayer } from "./IAutoMovieProductionRenderLayer";
import { resolveProductionFrameRate } from "./productionTimebase";

/**
 * Resolve one global frame, including exact dissolve and fade weights.
 *
 * The answer depends only on the timeline and the global frame number: the
 * active segment is the last one whose start-inclusive, end-exclusive range
 * contains the frame, a dissolve blends the outgoing segment's tail by the
 * integer frame offset, and a fade scales the one layer by the same offset.
 * Nothing reads a previous frame, so a browser seek, a chunk and a full render
 * resolve the same layers for the same frame.
 *
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-subrange-stability Resolves a frame from its global film time so a chunk or retry yields the same frame as a full render.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-boundary-convention Selects the segment whose start-inclusive, end-exclusive range contains the frame with integer comparisons.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Gives direct seek, subrange and chunk execution one state per global frame number and refuses a frame outside the schedule.
 */
export const sampleProductionRenderFrame = (
  timeline: IAutoMovieFilmTimeline,
  globalFrame: number,
): IAutoMovieProductionRenderFrame => {
  if (
    Number.isSafeInteger(globalFrame) === false ||
    globalFrame < 0 ||
    globalFrame >= timeline.totalFrames
  )
    throw new Error(
      `Film-global frame ${globalFrame} is outside 0..${timeline.totalFrames - 1}.`,
    );
  const active = timeline.segments
    .map((segment, index) => ({ segment, index }))
    .filter(
      ({ segment }) =>
        segment.startFrame <= globalFrame && globalFrame < segment.endFrame,
    );
  const current = active.at(-1);
  if (current === undefined)
    throw new Error(
      `Film-global frame ${globalFrame} has no builder-owned video segment.`,
    );
  const offset = globalFrame - current.segment.startFrame;
  const incoming: IAutoMovieProductionRenderLayer = {
    shot: current.segment.shot,
    sourceFrame: current.segment.sourceInFrame + offset,
    weight: 1,
  };
  if (
    current.segment.transitionIn.kind === "dissolve" &&
    offset < current.segment.transitionIn.durationFrames
  ) {
    const previous = timeline.segments[current.index - 1];
    if (previous === undefined)
      throw new Error(
        `Segment "${current.segment.shot}" dissolves without an outgoing segment.`,
      );
    const alpha = offset / current.segment.transitionIn.durationFrames;
    return frame(timeline, globalFrame, [
      {
        shot: previous.shot,
        sourceFrame:
          previous.sourceOutFrame -
          current.segment.transitionIn.durationFrames +
          offset,
        weight: 1 - alpha,
      },
      { ...incoming, weight: alpha },
    ]);
  }
  const fadeIn =
    current.segment.transitionIn.kind === "fade" &&
    offset < current.segment.transitionIn.durationFrames
      ? offset / current.segment.transitionIn.durationFrames
      : 1;
  const remaining = current.segment.endFrame - globalFrame;
  const fadeOut =
    current.segment.transitionOut.kind === "fade" &&
    remaining <= current.segment.transitionOut.durationFrames
      ? remaining / current.segment.transitionOut.durationFrames
      : 1;
  return frame(timeline, globalFrame, [
    { ...incoming, weight: Math.min(fadeIn, fadeOut) },
  ]);
};

/** Stamp the resolved layers with the frame's exact rational film time. */
const frame = (
  timeline: IAutoMovieFilmTimeline,
  globalFrame: number,
  layers: IAutoMovieProductionRenderLayer[],
): IAutoMovieProductionRenderFrame => {
  const frameRate = resolveProductionFrameRate(timeline);
  return {
    globalFrame,
    timelineFrame: globalFrame,
    timeSeconds: (globalFrame * frameRate.denominator) / frameRate.numerator,
    layers,
  };
};
