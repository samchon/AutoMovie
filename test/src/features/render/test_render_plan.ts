import { IAutoMovieRenderSpec } from "@automovie/interface";
import {
  ffmpegArgs,
  frameName,
  framePattern,
  frameTimes,
} from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const SPEC: IAutoMovieRenderSpec = {
  target: "shot-1",
  fps: 30,
  width: 1920,
  height: 1080,
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

/**
 * The deterministic render plan: the frame schedule, frame naming, and the
 * pinned ffmpeg argument vector built from a render spec.
 *
 * Scenarios:
 *
 * 1. A 2 s clip at 30 fps yields 60 frames sampled at exact rationals `i/30`
 *    (first 0, last 59/30), with no accumulation.
 * 2. A non-positive fps and a non-positive duration each yield zero frames.
 * 3. A non-finite fps or duration also yields zero frames; render planning must
 *    never allocate an unbounded frame array.
 * 4. Frame names zero-pad to the input pattern (`frame_00042.png` and
 *    `frame_%05d.png`).
 * 5. `ffmpegArgs` encodes the spec into the pinned H.264 / pixel-format / crf /
 *    faststart command.
 */
export const test_render_plan = (): void => {
  // 1. schedule
  const t = frameTimes(30, 2);
  TestValidator.equals("60 frames", t.length, 60);
  TestValidator.predicate("first frame at 0", nclose(t[0]!, 0));
  TestValidator.predicate("second frame at 1/30", nclose(t[1]!, 1 / 30));
  TestValidator.predicate("last frame at 59/30", nclose(t[59]!, 59 / 30));

  // 2. guards
  TestValidator.equals("fps <= 0 -> no frames", frameTimes(0, 2).length, 0);
  TestValidator.equals(
    "duration <= 0 -> no frames",
    frameTimes(30, 0).length,
    0,
  );
  TestValidator.equals(
    "non-finite fps -> no frames",
    frameTimes(Number.POSITIVE_INFINITY, 2).length,
    0,
  );
  TestValidator.equals(
    "non-finite duration -> no frames",
    frameTimes(30, Number.POSITIVE_INFINITY).length,
    0,
  );

  // 4. naming
  TestValidator.equals("frame name padded", frameName(42), "frame_00042.png");
  TestValidator.equals("frame pattern", framePattern(), "frame_%05d.png");

  // 5. ffmpeg args
  TestValidator.equals(
    "ffmpeg args from spec",
    ffmpegArgs(SPEC, "in/frame_%05d.png", "out.mp4"),
    [
      "-y",
      "-framerate",
      "30",
      "-i",
      "in/frame_%05d.png",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "20",
      "-r",
      "30",
      "-movflags",
      "+faststart",
      "out.mp4",
    ],
  );
};
