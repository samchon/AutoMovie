import {
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

const app = new AutoMovieApplication();

const script: IAutoMovieScript = {
  logline: "a two-beat film whose caption fps underflows",
  theme: "at least one frame",
  cast: [],
  beats: [
    { id: "beat-1", name: "one", summary: "the first beat", durationHint: 1 },
    { id: "beat-2", name: "two", summary: "the second beat", durationHint: 1 },
  ],
};

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

const shotFor = (beat: string): IAutoMovieShot => ({
  id: `shot:${beat}`,
  name: null,
  scene: scene.id,
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
});

// The film mixes a trimmed entry (a `trim.duration` the runtime honors) with an
// un-trimmed one (whose runtime comes from the referenced shot's duration) and
// carries an incoming transition on the second entry, so the sequence-runtime
// accumulator exercises every per-entry duration source it reads.
const film: IAutoMovieSequence = {
  id: "seq-1",
  name: null,
  fps: 24,
  shots: [
    {
      shot: "shot:beat-1",
      trim: { start: 0, duration: 0.5 },
      transition: null,
    },
    {
      shot: "shot:beat-2",
      trim: null,
      transition: { kind: "fade", duration: 0.3 },
    },
  ],
};

const slate: IAutoMovieMcpWritableSlate = {
  script,
  scene,
  shots: [shotFor("beat-1"), shotFor("beat-2")],
  beatEnds: [],
  notes: [],
  film,
};

/**
 * RenderService caption-plan runtime branches (#1040 coverage): the caption
 * plan mirrors the render plan's zero-frame policy with a located violation,
 * and its sequence-runtime accumulator honors a trimmed entry's own duration as
 * well as an un-trimmed entry's referenced shot duration.
 *
 * Scenarios:
 *
 * 1. `planCaptions` over a valid committed film whose fps × runtime rounds below
 *    one frame violates at `$input.fps` (and never invents a sidecar) — the
 *    same call drives the sequence-runtime accumulator across a trimmed and an
 *    un-trimmed entry.
 * 2. Negative twin: the same slate at a normal fps plans a sidecar.
 */
export const test_mcp_render_caption_runtime_edges = (): void => {
  const underflow = app.planCaptions({ slate, fps: 0.001 });
  TestValidator.predicate(
    "a caption fps below one frame violates at the fps path",
    underflow.sidecar === null &&
      hasViolation(underflow.validation, "range", "$input.fps"),
  );

  const planned = app.planCaptions({ slate, fps: 24 });
  TestValidator.predicate(
    "a normal caption fps plans a sidecar",
    planned.validation.success === true && planned.sidecar !== null,
  );
};
