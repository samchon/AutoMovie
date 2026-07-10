import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  IAutoMovieSequenceRenderFrame,
  planChunkedSequenceRender,
  planSequenceRender,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const shot = (id: string, duration: number): IAutoMovieShot => ({
  id,
  name: null,
  scene: "scene-duel",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration,
});

const SHOTS = [shot("shot:a", 2), shot("shot:b", 3)];

const SEQUENCE: IAutoMovieSequence = {
  id: "seq:duel",
  name: "duel",
  fps: 24,
  shots: [
    { shot: "shot:a", trim: { start: 0.5, duration: 1 }, transition: null },
    {
      shot: "shot:b",
      trim: { start: 1, duration: 2 },
      transition: { kind: "crossDissolve", duration: 0.5 },
    },
  ],
};

const SPEC: IAutoMovieRenderSpec = {
  target: SEQUENCE.id,
  fps: 4,
  width: 640,
  height: 360,
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

/** The whole plan is 10 frames (2.5 s @ fps 4), with a dissolve on frames 2-3. */
const sample = (frame: IAutoMovieSequenceRenderFrame) => ({
  timeSeconds: frame.timeSeconds,
  shot: frame.shot,
  shotTimeSeconds: frame.shotTimeSeconds,
  blend: frame.blend,
});

/**
 * A long sequence render is split into `chunkFrames`-sized, independently
 * renderable chunks so an arbitrarily long timeline renders in bounded windows.
 * The boundary is frame-atomic: each frame belongs to exactly one chunk, and
 * concatenating the chunks reproduces the whole render frame-for-frame.
 *
 * Scenarios:
 *
 * 1. A 10-frame plan at chunkFrames 3 splits into 4 contiguous chunks (3/3/3/1);
 *    frameEnd of each chunk equals the next chunk's frameStart (no
 *    gap/overlap).
 * 2. The chunks' frames, concatenated in order, reproduce the whole plan's frame
 *    samples exactly (count + per-frame time/shot/shotTimeSeconds/blend) — only
 *    the chunk-local index/path differ.
 * 3. The dissolve straddles the chunk-1 boundary (frame 2 in chunk 0, frame 3 in
 *    chunk 1); each keeps its exact blend, and no frame is duplicated or
 *    dropped.
 * 4. Chunk frames are re-indexed 0-based with chunk-scoped paths; startSeconds /
 *    endSeconds are the chunk's global first/last frame times.
 * 5. A single chunk (chunkFrames >= frameCount) reproduces the whole plan's frame
 *    samples 1:1.
 * 6. The reassembly manifest lists the chunk outputs in order with concat args; an
 *    extension-less output path still gets a chunk tag. A directory-qualified
 *    output (the resident default) keeps the concat list beside the output and
 *    its lines as basenames (ffmpeg resolves list entries against the list
 *    file's directory), and a dotted directory never captures the chunk tag.
 * 7. A non-positive or non-integer chunkFrames rejects.
 */
export const test_render_chunk_sequence = (): void => {
  const whole = planSequenceRender({
    sequence: SEQUENCE,
    shots: SHOTS,
    spec: SPEC,
  });
  TestValidator.equals("whole frame count", whole.frameCount, 10);

  const chunked = planChunkedSequenceRender({
    plan: whole,
    spec: SPEC,
    chunkFrames: 3,
  });

  // 1. contiguity
  TestValidator.equals("chunk count", chunked.chunkCount, 4);
  TestValidator.equals("frame count preserved", chunked.frameCount, 10);
  TestValidator.equals(
    "chunk frame ranges",
    chunked.chunks.map((c) => [c.frameStart, c.frameEnd, c.frameCount]),
    [
      [0, 3, 3],
      [3, 6, 3],
      [6, 9, 3],
      [9, 10, 1],
    ],
  );
  chunked.chunks.forEach((chunk, i) => {
    if (i > 0)
      TestValidator.equals(
        `chunk ${i} is contiguous`,
        chunk.frameStart,
        chunked.chunks[i - 1]!.frameEnd,
      );
  });

  // 2. union == whole (sample identity)
  const union = chunked.chunks.flatMap((c) => c.frames);
  TestValidator.equals("union frame count == whole", union.length, 10);
  TestValidator.equals(
    "union samples == whole samples",
    union.map(sample),
    whole.frames.map(sample),
  );

  // 3. straddling dissolve keeps blends, no dup/drop
  TestValidator.equals(
    "dissolve start (frame 2) in chunk 0",
    chunked.chunks[0]!.frames[2]!.blend,
    whole.frames[2]!.blend,
  );
  TestValidator.equals(
    "mid dissolve (frame 3) in chunk 1",
    chunked.chunks[1]!.frames[0]!.blend,
    whole.frames[3]!.blend,
  );

  // 4. re-index + chunk-scoped paths + span times
  TestValidator.equals(
    "chunk 1 local indices",
    chunked.chunks[1]!.frames.map((f) => f.index),
    [0, 1, 2],
  );
  TestValidator.equals(
    "chunk 1 first path",
    chunked.chunks[1]!.frames[0]!.path,
    "frames/seq_duel/chunk_1/frame_00000.png",
  );
  TestValidator.equals(
    "chunk 1 output",
    chunked.chunks[1]!.outputPath,
    "seq_duel.chunk_1.mp4",
  );
  TestValidator.equals(
    "chunk 1 span",
    [chunked.chunks[1]!.startSeconds, chunked.chunks[1]!.endSeconds],
    [whole.frames[3]!.timeSeconds, whole.frames[5]!.timeSeconds],
  );
  TestValidator.predicate(
    "chunk ffmpeg args reference chunk paths",
    chunked.chunks[1]!.ffmpegArgs.includes(
      "frames/seq_duel/chunk_1/frame_%05d.png",
    ) && chunked.chunks[1]!.ffmpegArgs.includes("seq_duel.chunk_1.mp4"),
  );

  // 5. single chunk == whole samples
  const single = planChunkedSequenceRender({
    plan: whole,
    spec: SPEC,
    chunkFrames: 100,
  });
  TestValidator.equals("single chunk count", single.chunkCount, 1);
  TestValidator.equals(
    "single chunk reproduces whole samples",
    single.chunks[0]!.frames.map(sample),
    whole.frames.map(sample),
  );

  // 6. reassembly order + extensionless output
  TestValidator.equals(
    "reassembly output",
    chunked.reassembly.outputPath,
    "seq_duel.mp4",
  );
  TestValidator.equals(
    "reassembly chunk outputs in order",
    chunked.reassembly.chunkOutputs,
    [
      "seq_duel.chunk_0.mp4",
      "seq_duel.chunk_1.mp4",
      "seq_duel.chunk_2.mp4",
      "seq_duel.chunk_3.mp4",
    ],
  );
  TestValidator.equals(
    "reassembly concat lines",
    chunked.reassembly.concatListLines[0],
    "file 'seq_duel.chunk_0.mp4'",
  );
  TestValidator.predicate(
    "reassembly concat args are lossless",
    chunked.reassembly.ffmpegArgs.includes("concat") &&
      chunked.reassembly.ffmpegArgs.includes("copy") &&
      chunked.reassembly.ffmpegArgs.includes("seq_duel.mp4"),
  );

  const noExt = planChunkedSequenceRender({
    plan: planSequenceRender({
      sequence: SEQUENCE,
      shots: SHOTS,
      spec: SPEC,
      outputPath: "out/render",
    }),
    spec: SPEC,
    chunkFrames: 6,
  });
  TestValidator.equals(
    "extensionless chunk output",
    noExt.chunks[0]!.outputPath,
    "out/render.chunk_0",
  );

  // 6b. a directory-qualified output (the resident default) keeps chunk videos
  // beside the list file and the concat lines relative to it — ffmpeg resolves
  // list entries against the list file's directory, so a path-qualified line
  // ("renders/seq.chunk_0.mp4") would double the directory.
  const nested = planChunkedSequenceRender({
    plan: planSequenceRender({
      sequence: SEQUENCE,
      shots: SHOTS,
      spec: SPEC,
      outputPath: "renders/seq_duel.mp4",
    }),
    spec: SPEC,
    chunkFrames: 6,
  });
  TestValidator.equals(
    "nested chunk outputs keep the directory",
    nested.reassembly.chunkOutputs,
    ["renders/seq_duel.chunk_0.mp4", "renders/seq_duel.chunk_1.mp4"],
  );
  TestValidator.equals(
    "nested concat list sits beside the output",
    nested.reassembly.concatListPath,
    "renders/seq_duel.mp4.concat.txt",
  );
  TestValidator.equals(
    "nested concat lines are basenames relative to the list",
    nested.reassembly.concatListLines,
    ["file 'seq_duel.chunk_0.mp4'", "file 'seq_duel.chunk_1.mp4'"],
  );

  // 6c. a dotted directory never captures the chunk tag
  const dottedDir = planChunkedSequenceRender({
    plan: planSequenceRender({
      sequence: SEQUENCE,
      shots: SHOTS,
      spec: SPEC,
      outputPath: "out.v2/render",
    }),
    spec: SPEC,
    chunkFrames: 6,
  });
  TestValidator.equals(
    "dotted directory keeps the tag on the file",
    dottedDir.chunks[0]!.outputPath,
    "out.v2/render.chunk_0",
  );

  // 7. guards
  TestValidator.predicate(
    "zero chunkFrames rejects",
    throwsError(
      () =>
        planChunkedSequenceRender({ plan: whole, spec: SPEC, chunkFrames: 0 }),
      ["chunkFrames", "positive integer"],
    ),
  );
  TestValidator.predicate(
    "fractional chunkFrames rejects",
    throwsError(
      () =>
        planChunkedSequenceRender({
          plan: whole,
          spec: SPEC,
          chunkFrames: 1.5,
        }),
      ["chunkFrames", "positive integer"],
    ),
  );
};
