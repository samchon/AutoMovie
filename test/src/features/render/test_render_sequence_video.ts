import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  IAutoMovieSequenceRenderAdapters,
  renderSequenceAndSee,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

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
  id: "seq-duel",
  name: "duel",
  fps: 24,
  shots: [
    { shot: "shot:a", trim: null, transition: null },
    {
      shot: "shot:b",
      trim: { start: 1, duration: 2 },
      transition: { kind: "fade", duration: 0.5 },
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
 * `renderSequenceAndSee` turns a sequence manifest into host I/O calls: every
 * frame capture receives the live shot local time and blend tail, then encode
 * receives the manifest's ffmpeg args.
 *
 * Scenarios:
 *
 * 1. A two-shot sequence yields capture calls in frame order and returns the
 *    adapter-written frame paths.
 * 2. Frames inside the incoming transition expose the outgoing shot tail and
 *    incoming alpha to the host adapter.
 * 3. The encode adapter receives exactly the manifest args/output path, and the
 *    returned artifact preserves the spec and sequence identity.
 */
export const test_render_sequence_video = async (): Promise<void> => {
  const captured: Array<{
    index: number;
    shot: string;
    time: number;
    blend: string | null;
    alpha: number | null;
  }> = [];
  const encoded: Array<{ args: string[]; outputPath: string }> = [];
  const adapters: IAutoMovieSequenceRenderAdapters = {
    captureFrame: async (frame) => {
      captured.push({
        index: frame.index,
        shot: frame.shot,
        time: frame.shotTimeSeconds,
        blend: frame.blend?.shot ?? null,
        alpha: frame.blend?.alpha ?? null,
      });
      return `written/frame_${frame.index}.png`;
    },
    encode: async (args, outputPath) => {
      encoded.push({ args, outputPath });
      return `encoded:${outputPath}`;
    },
  };

  const result = await renderSequenceAndSee({
    sequence: SEQUENCE,
    shots: SHOTS,
    spec: SPEC,
    frameDir: "frames/seq",
    outputPath: "out/seq.mp4",
    adapters,
  });

  // 1. capture order and returned frame paths
  TestValidator.equals("frame count", result.frameCount, 14);
  TestValidator.equals(
    "capture order",
    captured.map((frame) => frame.index),
    Array.from({ length: 14 }, (_, i) => i),
  );
  TestValidator.equals(
    "first captured path",
    result.frames[0]!.path,
    "written/frame_0.png",
  );
  TestValidator.equals(
    "last captured path",
    result.frames[13]!.path,
    "written/frame_13.png",
  );

  // 2. transition sample semantics
  TestValidator.predicate(
    "entry transition begins at frame 6",
    captured[6]!.shot === "shot:b" &&
      nclose(captured[6]!.time, 1) &&
      captured[6]!.blend === "shot:a" &&
      nclose(captured[6]!.alpha ?? -1, 0),
  );
  TestValidator.predicate(
    "mid transition alpha",
    captured[7]!.shot === "shot:b" &&
      nclose(captured[7]!.time, 1.25) &&
      captured[7]!.blend === "shot:a" &&
      nclose(captured[7]!.alpha ?? -1, 0.5),
  );
  TestValidator.equals("past transition", captured[8]!.blend, null);

  // 3. encode and artifact metadata
  TestValidator.equals("encoded output", result.output, "encoded:out/seq.mp4");
  TestValidator.equals("sequence identity", result.sequence, {
    id: SEQUENCE.id,
    fps: 24,
  });
  TestValidator.equals("spec snapshot", result.spec, SPEC);
  TestValidator.equals(
    "encode output path",
    encoded[0]?.outputPath,
    "out/seq.mp4",
  );
  TestValidator.equals("encode args", encoded[0]?.args, result.plan.ffmpegArgs);
  TestValidator.equals(
    "planned input pattern",
    result.inputPattern,
    "frames/seq/frame_%05d.png",
  );
};
