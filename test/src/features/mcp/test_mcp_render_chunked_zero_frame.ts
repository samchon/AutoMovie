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
  logline: "a film too short for its clock",
  theme: "brevity",
  cast: [],
  beats: [
    {
      id: "beat-1",
      name: "beat one",
      summary: "the only beat",
      durationHint: 0.4,
    },
  ],
};

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 0.4,
};

const sequence: IAutoMovieSequence = {
  id: "seq-blink",
  name: "blink",
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

const spec = (fps: number): IAutoMovieRenderSpec => ({
  target: sequence.id,
  frameFormat: { fps, width: 640, height: 360 },
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
});

/**
 * `planChunkedRender` answers a degenerate fps × duration with the same
 * field-located violation `planRender` already returns, instead of letting
 * `planSequenceRender`'s raw "requires at least one frame" Error escape to the
 * MCP client (#1092), the server instruction pins "every failure returns
 * field-located violations, not a thrown error".
 *
 * Scenarios (0.4 s film, explicit slate):
 *
 * 1. Fps 1 rounds to zero output frames: `planChunkedRender` returns a range
 *    violation at `$input.spec.frameFormat.fps` (no throw, no plan).
 * 2. Parity: `planRender` on the same request locates the identical path, so the
 *    two planners diagnose the degenerate clock identically.
 * 3. Negative twin: fps 10 yields 4 frames and a real chunk plan (2 chunks of 2 at
 *    `chunkFrames: 2`).
 */
export const test_mcp_render_chunked_zero_frame = (): void => {
  const app = new AutoMovieApplication();

  // 1. zero output frames → violation, not a thrown engine error
  const chunked = app.planChunkedRender({
    slate,
    spec: spec(1),
    chunkFrames: 2,
  });
  TestValidator.predicate(
    "a zero-frame chunked plan is a field-located violation",
    chunked.plan === null &&
      chunked.validation.success === false &&
      chunked.validation.violations.some(
        (violation) =>
          violation.kind === "range" &&
          violation.path === "$input.spec.frameFormat.fps",
      ),
  );

  // 2. parity with planRender's gate on the same degenerate request
  const whole = app.planRender({ slate, spec: spec(1) });
  TestValidator.equals(
    "planRender and planChunkedRender locate the same violation path",
    whole.validation.success === false
      ? whole.validation.violations.map((violation) => violation.path)
      : [],
    chunked.validation.success === false
      ? chunked.validation.violations.map((violation) => violation.path)
      : ["(chunked succeeded)"],
  );

  // 3. negative twin: one more fps decade and the plan is real
  const fine = app.planChunkedRender({ slate, spec: spec(10), chunkFrames: 2 });
  if (fine.plan === null) throw new Error("fps 10 chunked plan must succeed");
  TestValidator.equals(
    "fps 10 plans 4 frames in 2 chunks",
    [fine.plan.frameCount, fine.plan.chunkCount],
    [4, 2],
  );
};
