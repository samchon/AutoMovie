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

const shot: IAutoMovieShot = {
  id: "shot:a",
  name: null,
  scene: "scene-1",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const sequence: IAutoMovieSequence = {
  id: "seq:cut",
  name: null,
  fps: 24,
  shots: [{ shot: shot.id, trim: null, transition: null }],
};

const spec: IAutoMovieRenderSpec = {
  target: sequence.id,
  frameFormat: { fps: 4, width: 640, height: 360 },
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

const planWith = (outputPath: string) =>
  planChunkedSequenceRender({
    plan: planSequenceRender({
      sequence,
      shots: [shot],
      spec,
      outputPath,
    }),
    spec,
    chunkFrames: 2,
  });

/**
 * The concat-demuxer list quotes each entry as `file '<basename>'`, and
 * ffmpeg's quoted string ends at the FIRST apostrophe, so a caller/LLM supplied
 * output like `directors'cut.mp4` malformed the list and the lossless
 * reassembly failed or misparsed (#1089). Entries now escape each apostrophe
 * with the `'\''` close-escape-reopen idiom the demuxer's token grammar
 * parses.
 *
 * Scenarios (4-frame plan, 2 chunks):
 *
 * 1. An apostrophe basename escapes in every concat line, while the chunk output
 *    paths themselves keep the literal apostrophe (the spawn-adapter argument
 *    vector needs no quoting).
 * 2. Negative twin: an apostrophe-free basename stays byte-identical to the
 *    unescaped form.
 */
export const test_render_concat_escape = (): void => {
  // 1. apostrophe basenames escape per the demuxer grammar
  const cut = planWith("renders/directors'cut.mp4");
  TestValidator.equals(
    "concat lines escape each apostrophe",
    cut.reassembly.concatListLines,
    [
      "file 'directors'\\''cut.chunk_0.mp4'",
      "file 'directors'\\''cut.chunk_1.mp4'",
    ],
  );
  TestValidator.equals(
    "the chunk outputs keep the literal apostrophe",
    cut.reassembly.chunkOutputs,
    ["renders/directors'cut.chunk_0.mp4", "renders/directors'cut.chunk_1.mp4"],
  );

  // 2. negative twin: a plain basename is untouched
  const plain = planWith("renders/cut.mp4");
  TestValidator.equals(
    "apostrophe-free lines stay unescaped",
    plain.reassembly.concatListLines,
    ["file 'cut.chunk_0.mp4'", "file 'cut.chunk_1.mp4'"],
  );
};
