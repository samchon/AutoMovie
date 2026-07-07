import { IAutoMovieRenderSpec } from "@automovie/interface";

import { ffmpegArgs, frameName, framePattern } from "./plan";
import {
  IAutoMovieSequenceRenderFrame,
  IAutoMovieSequenceRenderPlan,
} from "./sequenceRenderPlan";

/**
 * One independently-renderable slice of a sequence render — a contiguous range
 * of the whole plan's output frames with its own frame directory, paths, and
 * encoder output. A 1-hour film is rendered (and regenerated) chunk by chunk in
 * bounded windows without ever holding the whole timeline at once.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderChunk {
  /** Chunk ordinal (0-based, capture order). */
  index: number;

  /** First global output frame index in this chunk (inclusive). */
  frameStart: number;

  /** One past the last global output frame index (exclusive). */
  frameEnd: number;

  /** Number of frames in this chunk. */
  frameCount: number;

  /** Global output second of this chunk's first frame. */
  startSeconds: number;

  /** Global output second of this chunk's last frame. */
  endSeconds: number;

  /**
   * The chunk's frames. Each carries a chunk-local
   * {@link IAutoMovieSequenceRenderFrame.index} and `path` (so the chunk
   * captures its own files independently), while every sample field —
   * `timeSeconds`, `shot`, `shotTimeSeconds`, `blend` — is copied verbatim from
   * the whole plan, so a chunk renders frame-identical to the same frames of
   * the un-chunked render.
   */
  frames: IAutoMovieSequenceRenderFrame[];

  /** Directory where this chunk's frame files should be written. */
  frameDir: string;

  /** First chunk frame path. */
  firstFrame: string;

  /** Last chunk frame path. */
  lastFrame: string;

  /** Ffmpeg input pattern for this chunk's frame sequence. */
  inputPattern: string;

  /** This chunk's encoded video output path. */
  outputPath: string;

  /** Exact ffmpeg argument vector for this chunk's encoded output. */
  ffmpegArgs: string[];
}

/**
 * The plan to stitch the rendered chunk videos back into one timeline.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderReassembly {
  /** Final video path (the whole plan's `outputPath`). */
  outputPath: string;

  /** Chunk output video paths, in play order. */
  chunkOutputs: string[];

  /** Path of the ffmpeg concat-demuxer list the host writes. */
  concatListPath: string;

  /** Lines of that list (`file '<path>'`), in play order. */
  concatListLines: string[];

  /** Ffmpeg argument vector that concatenates the chunk videos losslessly. */
  ffmpegArgs: string[];
}

/**
 * A long sequence render split into independently-renderable chunks plus the
 * plan to reassemble them.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderChunkPlan {
  /** Render target identity (copied from the whole plan). */
  target: IAutoMovieSequenceRenderPlan["target"];

  /** Output fps (copied from the whole plan). */
  renderFps: number;

  /** Total output frames across all chunks (equals the whole plan). */
  frameCount: number;

  /** Frames per chunk (the last chunk may be shorter). */
  chunkFrames: number;

  /** Number of chunks. */
  chunkCount: number;

  /** The chunks, in capture order. */
  chunks: IAutoMovieRenderChunk[];

  /** How to stitch the chunk outputs into the final video. */
  reassembly: IAutoMovieRenderReassembly;
}

/**
 * Split a {@link planSequenceRender} manifest into `chunkFrames`-sized,
 * independently-renderable chunks so an arbitrarily long timeline is rendered
 * in bounded windows.
 *
 * The boundary rule is **frame-atomic**: a frame is the indivisible unit and
 * belongs to exactly one chunk (chunks are contiguous slices of the whole
 * plan's `frames`, `[i·chunkFrames, (i+1)·chunkFrames)`). Because a
 * transition's blend is already baked into each output frame's `blend`, a
 * transition that straddles a chunk boundary is simply split at a frame
 * boundary with each frame keeping its exact blend — no frame is duplicated or
 * dropped, and concatenating the chunks reproduces the whole render
 * frame-for-frame. Deterministic: it only slices and re-labels the
 * already-rational frame schedule.
 *
 * Executing the chunks in parallel / on a render farm is a host concern; this
 * only produces the independent chunk manifests and the concat plan.
 *
 * @author Samchon
 */
export const planChunkedSequenceRender = (props: {
  /** The whole-sequence render manifest to split. */
  plan: IAutoMovieSequenceRenderPlan;

  /** Render spec (for each chunk's encoder args); its `target` matched the plan. */
  spec: IAutoMovieRenderSpec;

  /** Output frames per chunk. A positive integer. */
  chunkFrames: number;
}): IAutoMovieRenderChunkPlan => {
  const { plan, spec, chunkFrames } = props;
  if (!Number.isInteger(chunkFrames) || chunkFrames <= 0)
    throw new Error(
      `chunkFrames must be a positive integer, but was ${chunkFrames}`,
    );

  const chunkCount = Math.ceil(plan.frames.length / chunkFrames);
  const pad = String(Math.max(chunkCount - 1, 0)).length;

  const chunks: IAutoMovieRenderChunk[] = Array.from(
    { length: chunkCount },
    (_, index): IAutoMovieRenderChunk => {
      const frameStart = index * chunkFrames;
      const frameEnd = Math.min(frameStart + chunkFrames, plan.frames.length);
      const slice = plan.frames.slice(frameStart, frameEnd);
      const label = `chunk_${String(index).padStart(pad, "0")}`;
      const frameDir = `${plan.frameDir}/${label}`;
      const frames: IAutoMovieSequenceRenderFrame[] = slice.map(
        (frame, local): IAutoMovieSequenceRenderFrame => ({
          ...frame,
          index: local,
          path: `${frameDir}/${frameName(local)}`,
        }),
      );
      const inputPattern = `${frameDir}/${framePattern()}`;
      const outputPath = taggedOutput(plan.outputPath, label);
      return {
        index,
        frameStart,
        frameEnd,
        frameCount: frames.length,
        startSeconds: slice[0]!.timeSeconds,
        endSeconds: slice[slice.length - 1]!.timeSeconds,
        frames,
        frameDir,
        firstFrame: `${frameDir}/${frameName(0)}`,
        lastFrame: `${frameDir}/${frameName(frames.length - 1)}`,
        inputPattern,
        outputPath,
        ffmpegArgs: ffmpegArgs(spec, inputPattern, outputPath),
      };
    },
  );

  const chunkOutputs = chunks.map((chunk) => chunk.outputPath);
  const concatListPath = `${plan.outputPath}.concat.txt`;
  return {
    target: plan.target,
    renderFps: plan.renderFps,
    frameCount: plan.frames.length,
    chunkFrames,
    chunkCount,
    chunks,
    reassembly: {
      outputPath: plan.outputPath,
      chunkOutputs,
      concatListPath,
      concatListLines: chunkOutputs.map((output) => `file '${output}'`),
      ffmpegArgs: [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy",
        plan.outputPath,
      ],
    },
  };
};

/** Insert a `.<label>` tag before the output's extension (or append it). */
const taggedOutput = (output: string, label: string): string => {
  const dot = output.lastIndexOf(".");
  return dot === -1
    ? `${output}.${label}`
    : `${output.slice(0, dot)}.${label}${output.slice(dot)}`;
};
