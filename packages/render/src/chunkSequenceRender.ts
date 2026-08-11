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
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk` makes the bounded chunk partition and its deterministic reassembly data explicit.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderChunk {
  /**
   * Chunk ordinal (0-based, capture order).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.index` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.index` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  index: number;

  /**
   * First global output frame index in this chunk (inclusive).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.frameStart` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.frameStart` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameStart: number;

  /**
   * One past the last global output frame index (exclusive).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.frameEnd` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.frameEnd` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameEnd: number;

  /**
   * Number of frames in this chunk.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.frameCount` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.frameCount` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameCount: number;

  /**
   * Global output second of this chunk's first frame.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.startSeconds` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.startSeconds` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  startSeconds: number;

  /**
   * Global output second of this chunk's last frame.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.endSeconds` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.endSeconds` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  endSeconds: number;

  /**
   * The chunk's frames. Each carries a chunk-local
   * {@link IAutoMovieSequenceRenderFrame.index} and `path` (so the chunk
   * captures its own files independently), while every sample field
   * (`timeSeconds`, `shot`, `shotTimeSeconds`, `blend`) is copied verbatim from
   * the whole plan, so a chunk renders frame-identical to the same frames of
   * the un-chunked render.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.frames` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.frames` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frames: IAutoMovieSequenceRenderFrame[];

  /**
   * Directory where this chunk's frame files should be written.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.frameDir` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.frameDir` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameDir: string;

  /**
   * First chunk frame path.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.firstFrame` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.firstFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  firstFrame: string;

  /**
   * Last chunk frame path.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.lastFrame` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.lastFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  lastFrame: string;

  /**
   * Ffmpeg input pattern for this chunk's frame sequence.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.inputPattern` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.inputPattern` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  inputPattern: string;

  /**
   * This chunk's encoded video output path.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.outputPath` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.outputPath` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  outputPath: string;

  /**
   * Exact ffmpeg argument vector for this chunk's encoded output.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.ffmpegArgs` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.ffmpegArgs` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  ffmpegArgs: string[];

  /**
   * Per-pass output locations inside this chunk's frame dir, chunk-local
   * indices, present only when the plan requested guide passes. The `beauty`
   * pass's untagged paths coincide with {@link frames}' paths (it IS the base
   * capture); tagged passes sit beside them (`frame_00000.depth.png`).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunk.passOutputs` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunk.passOutputs` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  passOutputs?: IAutoMovieGuidePassOutput[];
}

/**
 * One guide pass's whole-timeline walk order across the chunks, how a diffusion
 * host visits every frame of a pass without a video concat: the chunk frame
 * directories in play order, with the per-chunk ffmpeg input pattern alongside
 * for hosts that want to encode a pass per chunk.
 *
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderPassManifest` makes the bounded chunk partition and its deterministic reassembly data explicit.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderPassManifest` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderPassManifest {
  /**
   * The guide pass this manifest walks.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderPassManifest.pass` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderPassManifest.pass` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  pass: AutoMovieGuidePass;

  /**
   * Chunk frame directories in play order.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderPassManifest.chunkFrameDirs` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderPassManifest.chunkFrameDirs` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  chunkFrameDirs: string[];

  /**
   * Per-chunk ffmpeg input patterns, parallel to {@link chunkFrameDirs}.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderPassManifest.inputPatterns` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderPassManifest.inputPatterns` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  inputPatterns: string[];

  /**
   * Total frames of the pass across all chunks (equals the plan's).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderPassManifest.frameCount` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderPassManifest.frameCount` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameCount: number;
}

/**
 * The plan to stitch the rendered chunk videos back into one timeline.
 *
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderReassembly` makes the bounded chunk partition and its deterministic reassembly data explicit.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderReassembly` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderReassembly {
  /**
   * Final video path (the whole plan's `outputPath`).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderReassembly.outputPath` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderReassembly.outputPath` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  outputPath: string;

  /**
   * Chunk output video paths, in play order.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderReassembly.chunkOutputs` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderReassembly.chunkOutputs` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  chunkOutputs: string[];

  /**
   * Path of the ffmpeg concat-demuxer list the host writes.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderReassembly.concatListPath` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderReassembly.concatListPath` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  concatListPath: string;

  /**
   * Lines of that list (`file '<path>'`), in play order.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderReassembly.concatListLines` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderReassembly.concatListLines` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  concatListLines: string[];

  /**
   * Ffmpeg argument vector that concatenates the chunk videos losslessly.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderReassembly.ffmpegArgs` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderReassembly.ffmpegArgs` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  ffmpegArgs: string[];
}

/**
 * A long sequence render split into independently-renderable chunks plus the
 * plan to reassemble them.
 *
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunkPlan` makes the bounded chunk partition and its deterministic reassembly data explicit.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunkPlan` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderChunkPlan {
  /**
   * Render target identity (copied from the whole plan).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunkPlan.target` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunkPlan.target` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  target: IAutoMovieSequenceRenderPlan["target"];

  /**
   * Output fps (copied from the whole plan).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunkPlan.renderFps` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunkPlan.renderFps` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  renderFps: number;

  /**
   * Total output frames across all chunks (equals the whole plan).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunkPlan.frameCount` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunkPlan.frameCount` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameCount: number;

  /**
   * Frames per chunk (the last chunk may be shorter).
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunkPlan.chunkFrames` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunkPlan.chunkFrames` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  chunkFrames: number;

  /**
   * Number of chunks.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunkPlan.chunkCount` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunkPlan.chunkCount` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  chunkCount: number;

  /**
   * The chunks, in capture order.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunkPlan.chunks` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunkPlan.chunks` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  chunks: IAutoMovieRenderChunk[];

  /**
   * How to stitch the chunk outputs into the final video.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunkPlan.reassembly` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunkPlan.reassembly` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  reassembly: IAutoMovieRenderReassembly;

  /**
   * Per-pass whole-timeline walk orders, present only when guide passes were
   * requested. The `beauty` pass reassembles as video through
   * {@link reassembly}; tagged passes terminate as frame sequences (diffusion
   * consumes frames, not videos), so their reassembly IS this walk order.
   *
   * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `IAutoMovieRenderChunkPlan.passManifests` makes the bounded chunk partition and its deterministic reassembly data explicit.
   * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `IAutoMovieRenderChunkPlan.passManifests` exposes that responsibility through the package-independent system contract.
   * @author Samchon
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
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-partition `planChunkedSequenceRender` makes the bounded chunk partition and its deterministic reassembly data explicit.
 * @evidence specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-chunk-recovery `planChunkedSequenceRender` exposes that responsibility through the package-independent system contract.
 * @evidence requirements/rendering/chunks-resume-and-recovery.md#rendering-chunk-assembly Emits the ordered lossless concat plan that closes all chunk outputs into the requested artifact.
 * @evidenceExclude requirements/rendering/README.md#rendering-요구사항 Chunk planning partitions an ordered schedule; publication, concurrent ownership, and runtime recovery execution remain downstream.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-atomic-publication Chunk planning partitions an ordered schedule; publication, concurrent ownership, and runtime recovery execution remain downstream.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-concurrent-work Chunk planning partitions an ordered schedule; publication, concurrent ownership, and runtime recovery execution remain downstream.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-failure-recovery Chunk planning partitions an ordered schedule; publication, concurrent ownership, and runtime recovery execution remain downstream.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-recovery-refusal Chunk planning partitions an ordered schedule; publication, concurrent ownership, and runtime recovery execution remain downstream.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-resume Chunk planning partitions an ordered schedule; publication, concurrent ownership, and runtime recovery execution remain downstream.
 * @evidenceExclude requirements/rendering/chunks-resume-and-recovery.md#rendering-retry-identity Chunk planning partitions an ordered schedule; publication, concurrent ownership, and runtime recovery execution remain downstream.
 * @evidenceExclude specifications/editorial-render-and-delivery/README.md#editorial-render와-delivery-system-specifications Chunk planning supplies deterministic recovery units; budget preflight and publication identity remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-budget-preflight Chunk planning supplies deterministic recovery units; budget preflight and publication identity remain separate.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-budget-identity-and-recovery.md#spec-render-frame-identity Chunk planning supplies deterministic recovery units; budget preflight and publication identity remain separate.
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
