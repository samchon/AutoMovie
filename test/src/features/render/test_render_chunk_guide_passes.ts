import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
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

/**
 * The chunked render plans guide passes per chunk — the 1-hour film's real
 * path: chunking (#609) × guide passes (#608) in one manifest. Each chunk's
 * per-pass paths carry the chunk-local re-base exactly like its beauty frames,
 * so a single chunk renders a pass frame-identical to the same frames of the
 * whole render modulo the chunk dir + re-base; tagged passes terminate as frame
 * sequences whose whole-timeline order is the pass manifest's chunk-dir walk.
 *
 * Scenarios:
 *
 * 1. A 10-frame plan at chunkFrames 3 with `["depth", "beauty", "depth"]` dedups
 *    to [depth, beauty] and every chunk gains passOutputs in that order.
 * 2. Hand oracles: chunk 1's depth first/last/pattern are the chunk-local tagged
 *    paths; chunk 3 (1 frame) starts and ends at frame_00000; the beauty pass's
 *    untagged paths coincide with the chunk's base frames.
 * 3. Parity modulo dir + re-base: the whole render's depth frame at global index 9
 *    is `frame_00009.depth.png` under the whole frameDir, while the chunk
 *    holding it addresses the same capture as `frame_00000.depth.png` under
 *    `chunk_3/` — global index − frameStart, exactly the beauty re-base.
 * 4. The pass manifests walk all chunks in play order with parallel per-chunk
 *    input patterns and the whole plan's frameCount.
 * 5. An unknown pass name throws before any chunk is built.
 * 6. An empty pass list plans empty pass sets (fields present, no outputs) — the
 *    planGuidePassOutputs convention.
 */
export const test_render_chunk_guide_passes = (): void => {
  const whole = planSequenceRender({
    sequence: SEQUENCE,
    shots: SHOTS,
    spec: SPEC,
  });
  const chunked = planChunkedSequenceRender({
    plan: whole,
    spec: SPEC,
    chunkFrames: 3,
    passes: ["depth", "beauty", "depth"],
  });

  // 1. dedup + per-chunk order
  TestValidator.equals(
    "every chunk plans [depth, beauty]",
    chunked.chunks.map((c) => c.passOutputs!.map((o) => o.pass)),
    [
      ["depth", "beauty"],
      ["depth", "beauty"],
      ["depth", "beauty"],
      ["depth", "beauty"],
    ],
  );

  // 2. hand oracles
  const depth1 = chunked.chunks[1]!.passOutputs![0]!;
  TestValidator.equals(
    "chunk 1 depth first frame",
    depth1.firstFrame,
    "frames/seq_duel/chunk_1/frame_00000.depth.png",
  );
  TestValidator.equals(
    "chunk 1 depth last frame",
    depth1.lastFrame,
    "frames/seq_duel/chunk_1/frame_00002.depth.png",
  );
  TestValidator.equals(
    "chunk 1 depth input pattern",
    depth1.inputPattern,
    "frames/seq_duel/chunk_1/frame_%05d.depth.png",
  );
  const depth3 = chunked.chunks[3]!.passOutputs![0]!;
  TestValidator.equals(
    "single-frame chunk starts and ends at frame_00000",
    [depth3.firstFrame, depth3.lastFrame],
    [
      "frames/seq_duel/chunk_3/frame_00000.depth.png",
      "frames/seq_duel/chunk_3/frame_00000.depth.png",
    ],
  );
  const beauty1 = chunked.chunks[1]!.passOutputs![1]!;
  TestValidator.equals(
    "beauty pass coincides with the chunk's base frames",
    [beauty1.firstFrame, beauty1.lastFrame],
    [chunked.chunks[1]!.frames[0]!.path, chunked.chunks[1]!.frames[2]!.path],
  );

  // 3. parity modulo dir + re-base (global 9 lives in chunk 3 at local 0)
  const wholePassLast = `${whole.frameDir}/frame_00009.depth.png`;
  TestValidator.equals(
    "whole-render depth path at global index 9",
    wholePassLast,
    "frames/seq_duel/frame_00009.depth.png",
  );
  TestValidator.equals(
    "the chunk addresses the same capture rebased",
    depth3.firstFrame.endsWith(
      `frame_${String(9 - chunked.chunks[3]!.frameStart).padStart(5, "0")}.depth.png`,
    ),
    true,
  );

  // 4. manifests
  TestValidator.equals(
    "manifest passes in dedup order",
    chunked.passManifests!.map((m) => m.pass),
    ["depth", "beauty"],
  );
  const depthManifest = chunked.passManifests![0]!;
  TestValidator.equals(
    "depth manifest walks all chunks in order",
    depthManifest.chunkFrameDirs,
    [
      "frames/seq_duel/chunk_0",
      "frames/seq_duel/chunk_1",
      "frames/seq_duel/chunk_2",
      "frames/seq_duel/chunk_3",
    ],
  );
  TestValidator.equals(
    "depth manifest patterns are parallel and tagged",
    depthManifest.inputPatterns,
    [
      "frames/seq_duel/chunk_0/frame_%05d.depth.png",
      "frames/seq_duel/chunk_1/frame_%05d.depth.png",
      "frames/seq_duel/chunk_2/frame_%05d.depth.png",
      "frames/seq_duel/chunk_3/frame_%05d.depth.png",
    ],
  );
  TestValidator.equals(
    "manifest frame count equals the whole plan",
    depthManifest.frameCount,
    10,
  );
  TestValidator.equals(
    "union of chunk pass frames equals the manifest count",
    chunked.chunks.reduce((sum, c) => sum + c.frameCount, 0),
    depthManifest.frameCount,
  );

  // 5. unknown pass throws
  TestValidator.predicate(
    "unknown pass rejects",
    throwsError(
      () =>
        planChunkedSequenceRender({
          plan: whole,
          spec: SPEC,
          chunkFrames: 3,
          passes: ["depth", "sketch"],
        }),
      ['unknown guide pass "sketch"'],
    ),
  );

  // 6. empty list plans empty sets
  const empty = planChunkedSequenceRender({
    plan: whole,
    spec: SPEC,
    chunkFrames: 3,
    passes: [],
  });
  TestValidator.equals(
    "empty passes yield empty per-chunk outputs",
    empty.chunks.map((c) => c.passOutputs),
    [[], [], [], []],
  );
  TestValidator.equals(
    "empty passes yield an empty manifest list",
    empty.passManifests,
    [],
  );
};
