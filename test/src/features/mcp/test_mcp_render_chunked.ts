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
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

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
  logline: "a chunked render",
  theme: "endurance",
  cast: [],
  beats: [
    {
      id: "beat-1",
      name: "beat one",
      summary: "the only beat",
      durationHint: 1,
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
  duration: 1,
};

const sequence: IAutoMovieSequence = {
  id: "seq-duel",
  name: "duel",
  fps: 24,
  shots: [{ shot: shot.id, trim: null, transition: null }],
};

// fps 10 over a 1 s film → 10 output frames; chunkFrames 4 → 3 chunks (4/4/2).
const filmSpec: IAutoMovieRenderSpec = {
  target: sequence.id,
  fps: 10,
  width: 640,
  height: 360,
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

const commitResident = (app: AutoMovieApplication): void => {
  app.commitScript({ script });
  app.commitScene({ scene, models: [] });
  app.commitShot({ shot });
  app.commitFilm({ film: sequence });
};

/**
 * The long-form chunking (#609/#644) and caption sidecar (#607) reach the MCP
 * surface as `planChunkedRender` and `planCaptions`, resident-or-explicit like
 * every render tool (#678). A two-hour film is planned in bounded, frame-atomic
 * chunks reassembled losslessly; the caption sidecar aligns chunk-for-chunk.
 *
 * Scenarios:
 *
 * 1. A resident `planChunkedRender` splits the committed film into frame-atomic
 *    chunks under `renders/`, with a lossless concat reassembly; the chunk
 *    frame counts sum to the whole render (nothing duplicated or dropped).
 * 2. Requesting `passes` adds per-chunk pass outputs and per-pass walk manifests.
 * 3. A resident `planCaptions` plans the whole sidecar and, with `chunkFrames`,
 *    one chunk-local sidecar per render chunk (frame counts sum to the whole).
 * 4. A shot target (not the film) is a violation — a shot renders whole.
 * 5. A non-positive / non-integer `chunkFrames` is a violation.
 * 6. An explicit slate keeps the legacy `frames/<stem>` defaults, byte-identical.
 * 7. Without a project and without a slate, both tools throw the openProject
 *    prompt every resident tool throws.
 */
export const test_mcp_render_chunked = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-chunk-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    commitResident(app);

    // 1. resident chunked plan, frame-atomic under renders/
    const chunked = app.planChunkedRender({
      spec: filmSpec,
      chunkFrames: 4,
    }).plan;
    if (chunked === null) throw new Error("resident chunked plan must succeed");
    TestValidator.equals("chunk frame count", chunked.frameCount, 10);
    TestValidator.equals("chunk count", chunked.chunkCount, 3);
    TestValidator.equals(
      "chunk boundaries",
      chunked.chunks.map((c) => [c.frameStart, c.frameEnd, c.frameCount]),
      [
        [0, 4, 4],
        [4, 8, 4],
        [8, 10, 2],
      ],
    );
    TestValidator.equals(
      "chunk frame counts sum to the whole render",
      chunked.chunks.reduce((sum, c) => sum + c.frameCount, 0),
      chunked.frameCount,
    );
    TestValidator.equals(
      "first chunk frame dir under renders/",
      chunked.chunks[0]!.frameDir,
      "renders/seq-duel/chunk_0",
    );
    TestValidator.predicate(
      "chunk plan omits per-frame samples (bounded payload)",
      chunked.chunks.every((c) => !("frames" in c)),
    );
    TestValidator.equals(
      "reassembly targets the whole output under renders/",
      chunked.reassembly.outputPath,
      "renders/seq-duel.mp4",
    );
    TestValidator.equals(
      "reassembly lists one output per chunk",
      chunked.reassembly.chunkOutputs.length,
      3,
    );
    TestValidator.predicate(
      "reassembly concat is lossless (-c copy)",
      chunked.reassembly.ffmpegArgs.includes("copy"),
    );
    TestValidator.equals(
      "beauty-only plan has no pass manifests",
      chunked.passManifests,
      undefined,
    );

    // 2. guide passes add per-chunk outputs + per-pass walk manifests
    const passed = app.planChunkedRender({
      spec: filmSpec,
      chunkFrames: 4,
      passes: ["depth"],
    }).plan;
    if (passed === null) throw new Error("passed chunked plan must succeed");
    TestValidator.predicate(
      "depth pass manifest present",
      passed.passManifests !== undefined &&
        passed.passManifests.some((m) => m.pass === "depth"),
    );
    TestValidator.predicate(
      "each chunk carries pass outputs",
      passed.chunks.every((c) => c.passOutputs !== undefined),
    );

    // 3. resident caption sidecar + chunk-aligned slices
    const captions = app.planCaptions({ fps: 10, chunkFrames: 4 });
    if (captions.sidecar === null)
      throw new Error("resident captions must succeed");
    TestValidator.equals(
      "sidecar frame count matches the render",
      captions.sidecar.frameCount,
      10,
    );
    if (captions.chunks === null)
      throw new Error("chunked captions must be present");
    TestValidator.equals("caption chunk count", captions.chunks.length, 3);
    TestValidator.equals(
      "caption chunk frame counts",
      captions.chunks.map((c) => c.frameCount),
      [4, 4, 2],
    );
    TestValidator.equals(
      "caption chunks sum to the whole sidecar",
      captions.chunks.reduce((sum, c) => sum + c.frameCount, 0),
      captions.sidecar.frameCount,
    );

    // captions without chunking omit the chunk slices
    const whole = app.planCaptions({ fps: 10 });
    TestValidator.equals(
      "unchunked captions omit chunk slices",
      whole.chunks,
      null,
    );

    // 4. a shot target is a violation (a shot renders whole)
    const shotTarget = app.planChunkedRender({
      spec: { ...filmSpec, target: shot.id },
      chunkFrames: 4,
    });
    TestValidator.equals(
      "shot target refused",
      shotTarget.validation.success,
      false,
    );
    TestValidator.equals("no plan on refusal", shotTarget.plan, null);

    // 5. a bad chunkFrames is a violation
    TestValidator.equals(
      "zero chunkFrames refused",
      app.planChunkedRender({ spec: filmSpec, chunkFrames: 0 }).validation
        .success,
      false,
    );
    TestValidator.equals(
      "fractional chunkFrames refused",
      app.planChunkedRender({ spec: filmSpec, chunkFrames: 2.5 }).validation
        .success,
      false,
    );

    // 6. explicit slate keeps the legacy frames/<stem> defaults, byte-identical
    const slate: IAutoMovieMcpWritableSlate = {
      script,
      scene,
      shots: [shot],
      beatEnds: [],
      notes: [],
      film: sequence,
    };
    const explicit = app.planChunkedRender({
      slate,
      spec: filmSpec,
      chunkFrames: 4,
    }).plan;
    if (explicit === null)
      throw new Error("explicit chunked plan must succeed");
    TestValidator.equals(
      "explicit slate keeps legacy frames/ chunk dir",
      explicit.chunks[0]!.frameDir,
      "frames/seq-duel/chunk_0",
    );
    TestValidator.equals(
      "explicit slate keeps legacy output",
      explicit.reassembly.outputPath,
      "seq-duel.mp4",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  // 7. no project + no slate throws the actionable openProject prompt
  const bare = new AutoMovieApplication();
  TestValidator.predicate(
    "planChunkedRender without project or slate throws openProject prompt",
    throwsError(
      () => bare.planChunkedRender({ spec: filmSpec, chunkFrames: 4 }),
      ["planChunkedRender", "no project is active"],
    ),
  );
  TestValidator.predicate(
    "planCaptions without project or slate throws openProject prompt",
    throwsError(
      () => bare.planCaptions({ fps: 10 }),
      ["planCaptions", "no project is active"],
    ),
  );
};
