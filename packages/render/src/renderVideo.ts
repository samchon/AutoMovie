import { IAutoMovieRenderSpec } from "@automovie/interface";

import { ffmpegArgs, frameName, framePattern, frameTimes } from "./plan";

/**
 * The host-supplied I/O a render needs. Kept as injected dependencies so the
 * orchestration ({@link renderVideo}) stays a pure, deterministic, testable
 * function while the environment-specific halves — a headless browser
 * screenshot and an ffmpeg spawn — live in the caller (the engine is
 * renderer-agnostic; this keeps the render pipeline the same way).
 *
 * @author Samchon
 */
export interface IAutoMovieRenderAdapters {
  /**
   * Render the scene at clip-local `timeSeconds` and write frame `index` into
   * `dir` under its {@link frameName}. Returns the written path.
   */
  captureFrame: (
    timeSeconds: number,
    index: number,
    dir: string,
  ) => Promise<string>;

  /** Run ffmpeg with `args` (from {@link ffmpegArgs}); resolve with `outputPath`. */
  encode: (args: string[], outputPath: string) => Promise<string>;
}

/**
 * One captured frame artifact.
 *
 * @author Samchon
 */
export interface IAutoMovieCapturedFrame {
  /** Zero-based frame index. */
  index: number;

  /** Clip-local sample time in seconds. */
  timeSeconds: number;

  /** Host path returned by `captureFrame`. */
  path: string;
}

/**
 * The outcome of a render: encoded video plus frame metadata an agent can
 * inspect without inferring paths from the ffmpeg pattern.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderResult {
  /** Path to the encoded video (the adapter's `encode` output). */
  output: string;

  /** Number of frames captured and encoded. */
  frameCount: number;

  /** The clip-local sample instants, one per frame (`t = i / fps`). */
  times: number[];

  /** Captured frame artifacts in encode order. */
  frames: IAutoMovieCapturedFrame[];

  /** Directory passed to each `captureFrame` call. */
  frameDir: string;

  /** Ffmpeg input pattern used to encode the frame sequence. */
  inputPattern: string;

  /** Exact ffmpeg argument vector handed to the encode adapter. */
  ffmpegArgs: string[];
}

/**
 * Render a clip of `durationSeconds` into a video, deterministically: compute
 * the frame schedule, capture each frame through the host adapter at its exact
 * `t = i / fps`, then encode the sequence with the pinned ffmpeg args.
 *
 * This is the spine of automovie's "frames → video" path and its
 * reproducibility guarantee — pure control flow over injected I/O, so the same
 * spec drives the same frames in the same order every time.
 *
 * @author Samchon
 */
export const renderVideo = async (
  spec: IAutoMovieRenderSpec,
  durationSeconds: number,
  dir: string,
  outputPath: string,
  adapters: IAutoMovieRenderAdapters,
): Promise<IAutoMovieRenderResult> => {
  const times = frameTimes(spec.frameFormat.fps, durationSeconds);
  if (times.length === 0)
    throw new Error(
      `renderVideo requires at least one frame; fps ${spec.frameFormat.fps} and duration ${durationSeconds} produced zero frames`,
    );

  const frames: string[] = [];
  for (let i = 0; i < times.length; ++i)
    frames.push(await adapters.captureFrame(times[i]!, i, dir));
  const inputPattern = `${dir}/${framePattern()}`;
  const args = ffmpegArgs(spec, inputPattern, outputPath);
  const output = await adapters.encode(args, outputPath);
  return {
    output,
    frameCount: frames.length,
    times,
    frames: frames.map((path, index) => ({
      index,
      timeSeconds: times[index]!,
      path,
    })),
    frameDir: dir,
    inputPattern,
    ffmpegArgs: args,
  };
};
