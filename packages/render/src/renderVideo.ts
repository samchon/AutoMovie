import { IautomovieRenderSpec } from "@automovie/interface";

import { ffmpegArgs, frameName, framePattern, frameTimes } from "./Plan";

/**
 * The host-supplied I/O a render needs. Kept as injected dependencies so the
 * orchestration ({@link renderVideo}) stays a pure, deterministic, testable
 * function while the environment-specific halves ??a headless browser
 * screenshot and an ffmpeg spawn ??live in the caller (the engine is
 * renderer-agnostic; this keeps the render pipeline the same way).
 */
export interface IautomovieRenderAdapters {
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

/** The outcome of a render: the encoded file and how many frames went into it. */
export interface IautomovieRenderResult {
  /** Path to the encoded video (the adapter's `encode` output). */
  output: string;

  /** Number of frames captured and encoded. */
  frameCount: number;

  /** The clip-local sample instants, one per frame (`t = i / fps`). */
  times: number[];
}

/**
 * Render a clip of `durationSeconds` into a video, deterministically: compute
 * the frame schedule, capture each frame through the host adapter at its exact
 * `t = i / fps`, then encode the sequence with the pinned ffmpeg args.
 *
 * This is the spine of automovie's "frames ??video" path and its reproducibility
 * guarantee ??pure control flow over injected I/O, so the same spec drives the
 * same frames in the same order every time.
 *
 * @author Samchon
 */
export const renderVideo = async (
  spec: IautomovieRenderSpec,
  durationSeconds: number,
  dir: string,
  outputPath: string,
  adapters: IautomovieRenderAdapters,
): Promise<IautomovieRenderResult> => {
  const times = frameTimes(spec.fps, durationSeconds);
  const frames: string[] = [];
  for (let i = 0; i < times.length; ++i)
    frames.push(await adapters.captureFrame(times[i]!, i, dir));
  const output = await adapters.encode(
    ffmpegArgs(spec, `${dir}/${framePattern()}`, outputPath),
    outputPath,
  );
  return { output, frameCount: frames.length, times };
};
