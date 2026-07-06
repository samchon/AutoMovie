import { IAutoMovieRenderSpec } from "@automovie/interface";
import {
  IAutoMovieRenderAdapters,
  IAutoMovieRenderAndSeeRequest,
  renderAndSee,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

const SPEC: IAutoMovieRenderSpec = {
  target: "shot-1",
  fps: 4,
  width: 320,
  height: 180,
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 22,
};

/**
 * `renderAndSee` turns the render pipeline into an agent-readable artifact:
 * explicit sample times, captured frame paths, ffmpeg args, and encoded
 * output.
 *
 * Scenario: a 0.5 s clip at 4 fps captures two frames, encodes once, and
 * returns JSON-round-trippable metadata matching the host adapter calls.
 */
export const test_render_and_see = async (): Promise<void> => {
  const captured: Array<{ timeSeconds: number; index: number; dir: string }> =
    [];
  const encoded: Array<{ args: string[]; outputPath: string }> = [];
  const adapters: IAutoMovieRenderAdapters = {
    captureFrame: async (timeSeconds, index, dir) => {
      captured.push({ timeSeconds, index, dir });
      return `${dir}/frame-${index}.png`;
    },
    encode: async (args, outputPath) => {
      encoded.push({ args, outputPath });
      return outputPath;
    },
  };
  const request: IAutoMovieRenderAndSeeRequest = {
    spec: SPEC,
    durationSeconds: 0.5,
    frameDir: "frames/shot-1",
    outputPath: "out/shot-1.mp4",
    adapters,
  };
  const result = await renderAndSee(request);

  TestValidator.equals("spec snapshot", result.spec, SPEC);
  TestValidator.equals("duration reported", result.durationSeconds, 0.5);
  TestValidator.equals("output path", result.output, "out/shot-1.mp4");
  TestValidator.equals("frame count", result.frameCount, 2);
  TestValidator.equals("sample times", result.times, [0, 0.25]);
  TestValidator.equals("captured calls", captured, [
    { timeSeconds: 0, index: 0, dir: "frames/shot-1" },
    { timeSeconds: 0.25, index: 1, dir: "frames/shot-1" },
  ]);
  TestValidator.equals("frame artifacts", result.frames, [
    {
      index: 0,
      timeSeconds: 0,
      path: "frames/shot-1/frame-0.png",
    },
    {
      index: 1,
      timeSeconds: 0.25,
      path: "frames/shot-1/frame-1.png",
    },
  ]);
  TestValidator.equals(
    "input pattern",
    result.inputPattern,
    "frames/shot-1/frame_%05d.png",
  );
  TestValidator.equals("encode call count", encoded.length, 1);
  TestValidator.equals(
    "encoded output arg",
    encoded[0]!.outputPath,
    "out/shot-1.mp4",
  );
  TestValidator.equals(
    "json artifact round trip",
    JSON.parse(JSON.stringify(result)) as typeof result,
    result,
  );
};
