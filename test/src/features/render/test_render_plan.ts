import { IAutoMovieRenderSpec } from "@automovie/interface";
import {
  ffmpegArgs,
  frameName,
  framePattern,
  frameTimes,
  renderPathStem,
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
 *    `frame_%05d.png`), and render path stems are file-safe.
 * 5. `ffmpegArgs` encodes the spec into the pinned H.264 / pixel-format / crf /
 *    output-size (`-s width x height`) / faststart command.
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
  TestValidator.equals(
    "path stem sanitizes separators and colons",
    renderPathStem("seq:duel/main"),
    "seq_duel_main",
  );
  TestValidator.equals(
    "empty path stem fallback",
    renderPathStem(""),
    "render",
  );
  // A stem must be exactly one safe component — never `.`/`..` (which would let
  // `renders/${stem}` escape the reserved dir), a trailing dot/space, or a
  // Windows reserved device name.
  TestValidator.equals(
    "a parent-dir stem cannot escape renders/",
    renderPathStem(".."),
    "render",
  );
  TestValidator.equals(
    "a self-dir stem cannot address renders/ itself",
    renderPathStem("."),
    "render",
  );
  TestValidator.equals(
    "a trailing dot is stripped (Windows drops it anyway)",
    renderPathStem("shot."),
    "shot",
  );
  TestValidator.equals(
    "a Windows reserved device name is defused",
    renderPathStem("con"),
    "_con",
  );
  TestValidator.equals(
    "a reserved name is reserved with any extension too",
    renderPathStem("NUL.mp4"),
    "_NUL.mp4",
  );
  TestValidator.equals(
    "internal .. between separators stays contained (one component)",
    renderPathStem("a/../../b"),
    "a_.._.._b",
  );

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
      "-s",
      "1920x1080",
      "-movflags",
      "+faststart",
      "out.mp4",
    ],
  );
};
