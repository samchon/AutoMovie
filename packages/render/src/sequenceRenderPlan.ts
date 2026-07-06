import {
  IAutoMoviePlaybackSample,
  IAutoMoviePlaybackTimeline,
  sequenceTimeline,
} from "@automovie/engine";
import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
  IAutoMovieTransition,
  IAutoMovieTrim,
} from "@automovie/interface";

import {
  ffmpegArgs,
  frameName,
  framePattern,
  frameTimes,
  renderPathStem,
} from "./plan";

/**
 * A shot entry resolved onto the sequence output clock.
 *
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderShotSpan {
  /** Index into `sequence.shots`. */
  entry: number;

  /** Shot id played by this entry. */
  shot: string;

  /** Global output second where the entry starts. */
  start: number;

  /** Global output second where the entry ends. */
  end: number;

  /** Seconds of the source shot that this entry plays. */
  played: number;

  /** Source shot-local second where playback begins. */
  offset: number;

  /** Trim copied from the sequence entry. */
  trim: IAutoMovieTrim | null;
}

/**
 * Incoming transition span on the output clock.
 *
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderTransitionSpan {
  /** Index of the incoming entry in `sequence.shots`. */
  entry: number;

  /** Outgoing shot id. */
  from: string;

  /** Incoming shot id. */
  to: string;

  /** Transition style copied from the sequence entry. */
  kind: IAutoMovieTransition["kind"];

  /** Global output second where the transition begins. */
  start: number;

  /** Global output second where the transition ends. */
  end: number;

  /** Transition overlap duration in seconds. */
  duration: number;
}

/**
 * A sequence frame sample ready for a render host.
 *
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderFrame {
  /** Zero-based output frame index. */
  index: number;

  /** Global output sample time in seconds. */
  timeSeconds: number;

  /** Frame path that the capture host should write. */
  path: string;

  /** Live shot id at this output frame. */
  shot: string;

  /** Live shot-local time in seconds. */
  shotTimeSeconds: number;

  /** Outgoing tail blended into this frame, or `null` for a hard cut. */
  blend: {
    /** Outgoing shot id. */
    shot: string;

    /** Outgoing shot-local time in seconds. */
    shotTimeSeconds: number;

    /** Incoming weight in `[0, 1)`. */
    alpha: number;
  } | null;
}

/**
 * Public sequence render manifest: editorial timeline, transition spans, frame
 * samples, output paths, and encoder args in one deterministic artifact.
 *
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderPlan {
  /** Render target identity. */
  target: { kind: "sequence"; id: string };

  /** Sequence fps as authored by the cut. */
  sequenceFps: number;

  /** Output fps from the render spec. */
  renderFps: number;

  /** Total output seconds after transition overlaps are subtracted. */
  durationSeconds: number;

  /** Number of output frames. */
  frameCount: number;

  /** Global output sample times, one per frame. */
  times: number[];

  /** Shot spans on the output clock. */
  shots: IAutoMovieSequenceRenderShotSpan[];

  /** Incoming transition spans on the output clock. */
  transitionSpans: IAutoMovieSequenceRenderTransitionSpan[];

  /** Frame samples in capture order. */
  frames: IAutoMovieSequenceRenderFrame[];

  /** Directory where frame files should be written. */
  frameDir: string;

  /** First output frame path. */
  firstFrame: string;

  /** Last output frame path. */
  lastFrame: string;

  /** Ffmpeg input pattern for the frame sequence. */
  inputPattern: string;

  /** Encoded video output path. */
  outputPath: string;

  /** Exact ffmpeg argument vector for the encoded output. */
  ffmpegArgs: string[];
}

/**
 * Build the render-layer manifest for a committed sequence. The output FPS is
 * controlled by the render spec; the cut's fps is preserved as editorial
 * metadata. Trim and transition arithmetic is delegated to the engine playback
 * timeline, then copied into the manifest so the capture host has no hidden
 * timing rules.
 *
 * @author Samchon
 */
export const planSequenceRender = (props: {
  /** Sequence being rendered. */
  sequence: IAutoMovieSequence;

  /** Committed shots referenced by the sequence. */
  shots: IAutoMovieShot[];

  /** Render parameters whose `target` must equal `sequence.id`. */
  spec: IAutoMovieRenderSpec;

  /** Optional frame directory override. */
  frameDir?: string;

  /** Optional encoded output path override. */
  outputPath?: string;
}): IAutoMovieSequenceRenderPlan => {
  if (props.spec.target !== props.sequence.id)
    throw new Error(
      `render spec target "${props.spec.target}" must equal sequence "${props.sequence.id}"`,
    );

  const timeline = sequenceTimeline(props.sequence, props.shots);
  const times = frameTimes(props.spec.fps, timeline.runtime);
  if (times.length === 0)
    throw new Error(
      `planSequenceRender requires at least one frame; fps ${props.spec.fps} and duration ${timeline.runtime} produced zero frames`,
    );

  const stem = renderPathStem(props.sequence.id);
  const frameDir = props.frameDir ?? `frames/${stem}`;
  const outputPath = props.outputPath ?? `${stem}.mp4`;
  const inputPattern = `${frameDir}/${framePattern()}`;
  return {
    target: { kind: "sequence", id: props.sequence.id },
    sequenceFps: props.sequence.fps,
    renderFps: props.spec.fps,
    durationSeconds: timeline.runtime,
    frameCount: times.length,
    times,
    shots: timeline.entries.map((entry) => ({
      entry: entry.entry,
      shot: entry.shot,
      start: entry.start,
      end: entry.start + entry.played,
      played: entry.played,
      offset: entry.offset,
      trim: props.sequence.shots[entry.entry]!.trim,
    })),
    transitionSpans: transitionSpans(props.sequence, timeline),
    frames: times.map((time, index) =>
      frameSample(props.sequence, timeline, time, index, frameDir),
    ),
    frameDir,
    firstFrame: `${frameDir}/${frameName(0)}`,
    lastFrame: `${frameDir}/${frameName(times.length - 1)}`,
    inputPattern,
    outputPath,
    ffmpegArgs: ffmpegArgs(props.spec, inputPattern, outputPath),
  };
};

const transitionSpans = (
  sequence: IAutoMovieSequence,
  timeline: IAutoMoviePlaybackTimeline,
): IAutoMovieSequenceRenderTransitionSpan[] =>
  timeline.entries.flatMap((entry) => {
    const transition = sequence.shots[entry.entry]!.transition;
    if (transition === null) return [];
    const outgoing = timeline.entries[entry.entry - 1]!;
    return [
      {
        entry: entry.entry,
        from: outgoing.shot,
        to: entry.shot,
        kind: transition.kind,
        start: entry.start,
        end: entry.start + transition.duration,
        duration: transition.duration,
      },
    ];
  });

const frameSample = (
  sequence: IAutoMovieSequence,
  timeline: IAutoMoviePlaybackTimeline,
  time: number,
  index: number,
  frameDir: string,
): IAutoMovieSequenceRenderFrame => {
  const sample = resolveFromTimeline(sequence, timeline, time);
  return {
    index,
    timeSeconds: time,
    path: `${frameDir}/${frameName(index)}`,
    shot: sample.shot,
    shotTimeSeconds: sample.time,
    blend:
      sample.blend === null
        ? null
        : {
            shot: sample.blend.shot,
            shotTimeSeconds: sample.blend.time,
            alpha: sample.blend.alpha,
          },
  };
};

const resolveFromTimeline = (
  sequence: IAutoMovieSequence,
  timeline: IAutoMoviePlaybackTimeline,
  seconds: number,
): IAutoMoviePlaybackSample => {
  let live = timeline.entries[0]!;
  for (const entry of timeline.entries)
    if (entry.start <= seconds && seconds < entry.start + entry.played)
      live = entry;

  const transition = sequence.shots[live.entry]!.transition;
  const elapsed = seconds - live.start;
  let blend: IAutoMoviePlaybackSample["blend"] = null;
  if (transition !== null && elapsed < transition.duration) {
    const outgoing = timeline.entries[live.entry - 1]!;
    blend = {
      shot: outgoing.shot,
      time: outgoing.offset + (seconds - outgoing.start),
      alpha: elapsed / transition.duration,
    };
  }
  return { shot: live.shot, time: live.offset + elapsed, blend };
};
