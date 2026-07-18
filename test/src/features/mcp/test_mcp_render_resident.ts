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
  logline: "a resident render",
  theme: "memory",
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

const spec: IAutoMovieRenderSpec = {
  target: shot.id,
  frameFormat: { fps: 10, width: 640, height: 360 },
  toneMapping: "none",
  codec: "h264",
  pixelFormat: "yuv420p",
  crf: 20,
};

/** Commit the full film ladder into the resident project (slate omitted). */
const commitResident = (app: AutoMovieApplication): void => {
  TestValidator.equals(
    "resident script committed",
    app.commitScript({ script }).committed,
    true,
  );
  TestValidator.equals(
    "resident scene committed",
    app.commitScene({ scene, models: [] }).committed,
    true,
  );
  TestValidator.equals(
    "resident shot committed",
    app.commitShot({ shot }).committed,
    true,
  );
  TestValidator.equals(
    "resident film committed",
    app.commitFilm({
      review: "the single-shot cut plays whole at the planned rate",
      film: sequence,
    }).committed,
    true,
  );
};

/**
 * The render tools join the resident-or-explicit contract every other stateful
 * tool already had (#678): omit `slate` and `planRender`/`seeFrame` read the
 * resident project, defaulting their frame and output paths into the reserved
 * `renders/` directory. An explicit slate stays a pure transform whose default
 * paths are byte-identical to the pre-#678 `frames/<stem>` behavior.
 *
 * Scenarios:
 *
 * 1. A resident `planRender` (no slate) plans the committed shot with paths under
 *    `renders/`, and the sequence target the same way.
 * 2. A resident `seeFrame` (no slate) previews with a `renders/` frame path.
 * 3. An explicit `frameDir`/`outputPath` overrides the resident default.
 * 4. An explicit slate keeps the legacy `frames/<stem>` / `<stem>.mp4` defaults,
 *    byte-identical.
 * 5. Without a project and without a slate, `planRender`/`seeFrame` throw the same
 *    actionable openProject prompt the other resident tools throw.
 */
export const test_mcp_render_resident = async (): Promise<void> => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-render-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    commitResident(app);

    // 1. resident shot plan defaults under renders/
    const shotPlan = app.planRender({ spec }).plan;
    if (shotPlan === null) throw new Error("resident shot plan must succeed");
    TestValidator.equals(
      "resident shot first frame under renders/",
      shotPlan.firstFrame,
      "renders/shot_beat-1/frame_00000.png",
    );
    TestValidator.equals(
      "resident shot output under renders/",
      shotPlan.outputPath,
      "renders/shot_beat-1.mp4",
    );
    TestValidator.predicate(
      "resident ffmpeg args use renders/ pattern",
      shotPlan.ffmpegArgs.includes("renders/shot_beat-1/frame_%05d.png") &&
        shotPlan.ffmpegArgs.includes("renders/shot_beat-1.mp4"),
    );

    // 1b. resident sequence plan defaults under renders/
    const seqPlan = app.planRender({
      spec: { ...spec, target: sequence.id },
    }).plan;
    if (seqPlan === null)
      throw new Error("resident sequence plan must succeed");
    TestValidator.equals(
      "resident sequence frame dir under renders/",
      seqPlan.frameDir,
      "renders/seq-duel",
    );
    TestValidator.equals(
      "resident sequence output under renders/",
      seqPlan.outputPath,
      "renders/seq-duel.mp4",
    );

    // 2. resident seeFrame previews with a renders/ frame path
    const preview = (await app.seeFrame({ spec, frame: 2 })).preview;
    if (preview === null) throw new Error("resident preview must succeed");
    TestValidator.equals(
      "resident preview frame path under renders/",
      preview.framePath,
      "renders/shot_beat-1/frame_00002.png",
    );
    TestValidator.equals(
      "resident preview honest adapterless status",
      preview.status,
      "no-capture-adapter",
    );

    // 3. explicit frameDir/outputPath overrides the resident default
    const overridden = app.planRender({
      spec,
      frameDir: "custom/dir",
      outputPath: "custom/out.mp4",
    }).plan;
    if (overridden === null) throw new Error("override plan must succeed");
    TestValidator.equals(
      "resident override honors explicit frameDir",
      overridden.firstFrame,
      "custom/dir/frame_00000.png",
    );
    TestValidator.equals(
      "resident override honors explicit outputPath",
      overridden.outputPath,
      "custom/out.mp4",
    );

    // 4. an explicit slate keeps the legacy frames/<stem> defaults
    const slate: IAutoMovieMcpWritableSlate = {
      script,
      scene,
      shots: [shot],
      beatEnds: [],
      notes: [],
      film: sequence,
    };
    const explicit = app.planRender({ slate, spec }).plan;
    if (explicit === null) throw new Error("explicit plan must succeed");
    TestValidator.equals(
      "explicit slate keeps legacy frames/ first frame",
      explicit.firstFrame,
      "frames/shot_beat-1/frame_00000.png",
    );
    TestValidator.equals(
      "explicit slate keeps legacy output",
      explicit.outputPath,
      "shot_beat-1.mp4",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  // 5. no project + no slate throws the actionable openProject prompt
  const bare = new AutoMovieApplication();
  TestValidator.predicate(
    "planRender without project or slate throws openProject prompt",
    throwsError(
      () => bare.planRender({ spec }),
      ["planRender", "no project is active"],
    ),
  );
  TestValidator.predicate(
    "seeFrame without project or slate throws openProject prompt",
    await (async () => {
      try {
        await bare.seeFrame({ spec });
        return false;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return (
          message.includes("seeFrame") &&
          message.includes("no project is active")
        );
      }
    })(),
  );
};
