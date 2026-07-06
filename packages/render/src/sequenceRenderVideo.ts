import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";

import {
  IAutoMovieSequenceRenderFrame,
  IAutoMovieSequenceRenderPlan,
  planSequenceRender,
} from "./sequenceRenderPlan";

/**
 * Host I/O for sequence rendering. The capture adapter receives the resolved
 * sequence frame sample, including the live shot local time and optional
 * outgoing blend tail; drawing pixels remains the host's job.
 *
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderAdapters {
  /** Capture one resolved sequence frame and return the written frame path. */
  captureFrame: (
    frame: IAutoMovieSequenceRenderFrame,
    plan: IAutoMovieSequenceRenderPlan,
  ) => Promise<string>;

  /** Encode the captured frame sequence and return the encoded output path. */
  encode: (args: string[], outputPath: string) => Promise<string>;
}

/**
 * The outcome of rendering a sequence through injected host I/O.
 *
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderResult {
  /** Path to the encoded video. */
  output: string;

  /** Number of captured frames. */
  frameCount: number;

  /** Global output sample times. */
  times: number[];

  /** Captured frame samples in encode order. */
  frames: IAutoMovieSequenceRenderFrame[];

  /** Directory passed through the manifest for frame files. */
  frameDir: string;

  /** Ffmpeg input pattern for the captured frame sequence. */
  inputPattern: string;

  /** Exact ffmpeg argument vector handed to the encode adapter. */
  ffmpegArgs: string[];

  /** The deterministic sequence manifest that drove capture. */
  plan: IAutoMovieSequenceRenderPlan;
}

/**
 * Host-supplied request for building a sequence manifest and rendering it.
 *
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderAndSeeRequest {
  /** Sequence being rendered. */
  sequence: IAutoMovieSequence;

  /** Committed shots referenced by the sequence. */
  shots: IAutoMovieShot[];

  /** Render parameters whose target must equal `sequence.id`. */
  spec: IAutoMovieRenderSpec;

  /** Directory where captured frames are written. */
  frameDir: string;

  /** Requested encoded video path. */
  outputPath: string;

  /** Capture and encode adapters owned by the host. */
  adapters: IAutoMovieSequenceRenderAdapters;
}

/**
 * JSON-friendly sequence render artifact.
 *
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderAndSeeResult extends IAutoMovieSequenceRenderResult {
  /** Render spec snapshot used for the sequence render. */
  spec: IAutoMovieRenderSpec;

  /** Sequence identity and authored fps snapshot. */
  sequence: { id: string; fps: number };
}

/**
 * Render a prepared sequence manifest: capture each resolved frame sample in
 * order, then encode the planned frame sequence with the planned ffmpeg args.
 * This is the sequence-level analogue of `renderVideo`, but the capture host
 * gets sequence semantics rather than only a clip-local second.
 *
 * @author Samchon
 */
export const renderSequenceVideo = async (
  plan: IAutoMovieSequenceRenderPlan,
  adapters: IAutoMovieSequenceRenderAdapters,
): Promise<IAutoMovieSequenceRenderResult> => {
  const frames: IAutoMovieSequenceRenderFrame[] = [];
  for (const frame of plan.frames)
    frames.push({
      ...frame,
      path: await adapters.captureFrame(frame, plan),
    });
  const output = await adapters.encode(plan.ffmpegArgs, plan.outputPath);
  return {
    output,
    frameCount: frames.length,
    times: plan.times,
    frames,
    frameDir: plan.frameDir,
    inputPattern: plan.inputPattern,
    ffmpegArgs: plan.ffmpegArgs,
    plan,
  };
};

/**
 * Build a sequence render manifest, execute it through host adapters, and
 * return an artifact an agent can inspect without recomputing the cut.
 *
 * @author Samchon
 */
export const renderSequenceAndSee = async (
  request: IAutoMovieSequenceRenderAndSeeRequest,
): Promise<IAutoMovieSequenceRenderAndSeeResult> => {
  const plan = planSequenceRender({
    sequence: request.sequence,
    shots: request.shots,
    spec: request.spec,
    frameDir: request.frameDir,
    outputPath: request.outputPath,
  });
  return {
    spec: { ...request.spec },
    sequence: { id: request.sequence.id, fps: request.sequence.fps },
    ...(await renderSequenceVideo(plan, request.adapters)),
  };
};
