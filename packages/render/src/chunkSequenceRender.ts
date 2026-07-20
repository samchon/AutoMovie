import { AutoMovieGuidePass, IAutoMovieRenderSpec } from "@automovie/interface";

import {
  IAutoMovieGuidePassOutput,
  guidePassFramePattern,
  normalizeGuidePasses,
  planGuidePassOutputs,
} from "./guidePasses";
import { ffmpegArgs, frameName, framePattern } from "./plan";
import {
  IAutoMovieSequenceRenderFrame,
  IAutoMovieSequenceRenderPlan,
} from "./sequenceRenderPlan";

/**
 * One independently-renderable slice of a sequence render: a contiguous range
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
   * captures its own files independently), while every sample field
   * (`timeSeconds`, `shot`, `shotTimeSeconds`, `blend`) is copied verbatim from
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

  /**
   * Per-pass output locations inside this chunk's frame dir, chunk-local
   * indices, present only when the plan requested guide passes. The `beauty`
   * pass's untagged paths coincide with {@link frames}' paths (it IS the base
   * capture); tagged passes sit beside them (`frame_00000.depth.png`).
   */
  passOutputs?: IAutoMovieGuidePassOutput[];
}

/**
 * One guide pass's whole-timeline walk order across the chunks, how a
 * diffusion host visits every frame of a pass without a video concat: the chunk
 * frame directories in play order, with the per-chunk ffmpeg input pattern
 * alongside for hosts that want to encode a pass per chunk.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderPassManifest {
  /** The guide pass this manifest walks. */
  pass: AutoMovieGuidePass;

  /** Chunk frame directories in play order. */
  chunkFrameDirs: string[];

  /** Per-chunk ffmpeg input patterns, parallel to {@link chunkFrameDirs}. */
  inputPatterns: string[];

  /** Total frames of the pass across all chunks (equals the plan's). */
  frameCount: number;
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

  /**
   * Per-pass whole-timeline walk orders, present only when guide passes were
   * requested. The `beauty` pass reassembles as video through
   * {@link reassembly}; tagged passes terminate as frame sequences (diffusion
   * consumes frames, not videos), so their reassembly IS this walk order.
   */
  passManifests?: IAutoMovieRenderPassManifest[];
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
 * boundary with each frame keeping its exact blend: no frame is duplicated or
 * dropped, and concatenating the chunks reproduces the whole render
 * frame-for-frame. Deterministic: it only slices and re-labels the
 * already-rational frame schedule.
 *
 * Executing the chunks in parallel / on a render farm is a host concern; this
 * only produces the independent chunk manifests and the concat plan.
 *
 * **Guide passes (#644).** When `passes` is given, every chunk also plans its
 * per-pass frame paths (chunk-local indices, the same re-base as the beauty
 * frames; naming via {@link planGuidePassOutputs}: `beauty` untagged and
 * coinciding with the chunk's base frames, others tagged
 * `frame_00000.depth.png`), and the plan gains one
 * {@link IAutoMovieRenderPassManifest} per pass. The output decision: `beauty`
 * keeps the per-chunk video encode and the concat reassembly (unchanged);
 * tagged passes terminate as **frame sequences**: diffusion guidance
 * (ControlNet et al.) consumes frames, not videos, with each chunk's ffmpeg
 * input pattern still emitted so a host that wants a video can encode one. No
 * per-pass concat exists; a pass's whole-timeline order IS its manifest's
 * chunk-dir walk. `passes` absent omits every pass field (byte-identical to the
 * pass-less plan); an empty list plans empty pass sets (the
 * {@link planGuidePassOutputs} convention); an unknown pass name throws before
 * any chunk is built.
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

  /** Guide passes to plan per chunk; omit for a beauty-only render. */
  passes?: readonly string[];
}): IAutoMovieRenderChunkPlan => {
  const { plan, spec, chunkFrames } = props;
  if (!Number.isInteger(chunkFrames) || chunkFrames <= 0)
    throw new Error(
      `chunkFrames must be a positive integer, but was ${chunkFrames}`,
    );
  const passes =
    props.passes === undefined ? undefined : normalizeGuidePasses(props.passes);

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
        ...(passes === undefined
          ? {}
          : {
              passOutputs: planGuidePassOutputs({
                frameDir,
                frameCount: frames.length,
                passes,
              }),
            }),
      };
    },
  );

  const chunkOutputs = chunks.map((chunk) => chunk.outputPath);
  const concatListPath = `${plan.outputPath}.concat.txt`;
  // ffmpeg's concat demuxer resolves relative entries against the LIST FILE's
  // directory, not the invoking cwd. The chunk outputs always sit beside the
  // list (taggedOutput preserves the directory), so the lines must carry
  // basenames. A directory-qualified output ("renders/seq.mp4") would
  // otherwise resolve to "renders/renders/seq.chunk_0.mp4". Each basename is
  // single-quote escaped: the demuxer's quoted string ends at the first `'`,
  // so an apostrophe basename ("directors'cut.mp4") otherwise malforms the
  // list and the lossless concat fails or misparses (#1089).
  const concatListLines = chunkOutputs.map(
    (output) => `file '${escapeConcatEntry(baseName(output))}'`,
  );
  return {
    target: plan.target,
    renderFps: plan.renderFps,
    frameCount: plan.frames.length,
    chunkFrames,
    chunkCount,
    chunks,
    ...(passes === undefined
      ? {}
      : {
          passManifests: passes.map(
            (pass): IAutoMovieRenderPassManifest => ({
              pass,
              chunkFrameDirs: chunks.map((chunk) => chunk.frameDir),
              inputPatterns: chunks.map(
                (chunk) => `${chunk.frameDir}/${guidePassFramePattern(pass)}`,
              ),
              frameCount: plan.frames.length,
            }),
          ),
        }),
    reassembly: {
      outputPath: plan.outputPath,
      chunkOutputs,
      concatListPath,
      concatListLines,
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

/** The path's last segment (after the final `/` or `\`). */
const baseName = (path: string): string =>
  path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

/**
 * Escape one concat-demuxer list entry for its single-quoted `file '…'` line: a
 * quoted string cannot CONTAIN `'`, so each apostrophe closes the quote, emits
 * an escaped quote, and reopens (`'` → `'\''`), the same idiom POSIX shells
 * use, and the grammar ffmpeg's `av_get_token` parses (#1089).
 */
const escapeConcatEntry = (name: string): string => name.replace(/'/g, "'\\''");

/**
 * Insert a `.<label>` tag before the output's extension (or append it). The
 * extension dot is scanned only within the basename, so a dotted directory
 * (`out.v2/render`) tags the file, not the directory.
 */
const taggedOutput = (output: string, label: string): string => {
  const dot = output.lastIndexOf(".");
  const separator = Math.max(output.lastIndexOf("/"), output.lastIndexOf("\\"));
  return dot <= separator
    ? `${output}.${label}`
    : `${output.slice(0, dot)}.${label}${output.slice(dot)}`;
};
