import {
  IAutoMovieRenderSpec,
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [],
  cameras: [
    {
      id: "camera",
      transform: IDENTITY_TRANSFORM,
      fovY: 45,
      near: 0.1,
      far: 100,
    },
  ],
  lights: [],
};

const script: IAutoMovieScript = {
  logline: "a render aimed at a percent path",
  theme: "escaping",
  cast: [],
  beats: [{ id: "beat-1", name: "beat", summary: "the beat", durationHint: 1 }],
};

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const sequence: IAutoMovieSequence = {
  id: "seq-pct",
  name: null,
  fps: 24,
  shots: [{ shot: shot.id, trim: null, transition: null }],
};

const slate: IAutoMovieMcpWritableSlate = {
  script,
  scene,
  shots: [shot],
  beatEnds: [],
  notes: [],
  film: sequence,
};

const spec: IAutoMovieRenderSpec = {
  target: sequence.id,
  frameFormat: { fps: 10, width: 640, height: 360 },
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

/**
 * A literal `%` in a render path override corrupts ffmpeg's image2 `-i` pattern
 * (`frame_%05d.png`): the demuxer reads it as a conversion specifier and
 * silently reads the wrong files — or none (#1089). The default paths are
 * stem-sanitized and can never carry one; only the overrides can, so the MCP
 * render boundary refuses them with a located violation.
 *
 * Scenarios:
 *
 * 1. `planRender` with `%` in `frameDir` and `planChunkedRender` with `%` in
 *    `outputPath` each refuse at the override's path.
 * 2. Negative twin: percent-free overrides plan normally and flow into the
 *    manifest verbatim.
 */
export const test_mcp_render_percent_paths = (): void => {
  const app = new AutoMovieApplication();

  // 1. percent overrides refuse at their located paths
  const percentFrameDir = app.planRender({
    slate,
    spec,
    frameDir: "frames/100%ature",
  });
  TestValidator.predicate(
    "a % frameDir override is refused at $input.frameDir",
    percentFrameDir.plan === null &&
      hasViolation(percentFrameDir.validation, "type", "$input.frameDir"),
  );
  const percentOutput = app.planChunkedRender({
    slate,
    spec,
    chunkFrames: 5,
    outputPath: "renders/100%.mp4",
  });
  TestValidator.predicate(
    "a % outputPath override is refused at $input.outputPath",
    percentOutput.plan === null &&
      hasViolation(percentOutput.validation, "type", "$input.outputPath"),
  );

  // 2. negative twin: clean overrides plan and flow through verbatim
  const clean = app.planRender({
    slate,
    spec,
    frameDir: "frames/nature",
    outputPath: "renders/nature.mp4",
  });
  TestValidator.predicate(
    "percent-free overrides flow into the plan verbatim",
    clean.plan !== null &&
      clean.plan.frameDir === "frames/nature" &&
      clean.plan.outputPath === "renders/nature.mp4",
  );
};
