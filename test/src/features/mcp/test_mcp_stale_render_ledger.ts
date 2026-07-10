import {
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
  logline: "renders outlive their film",
  theme: "honest directories",
  cast: [],
  beats: [
    { id: "beat-1", name: "the beat", summary: "one beat", durationHint: 1 },
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

const film: IAutoMovieSequence = {
  id: "seq-live",
  name: null,
  fps: 24,
  shots: [{ shot: shot.id, trim: null, transition: null }],
};

/**
 * The stale-render ledger (#1130): the server never deletes user-visible files,
 * so re-committing upstream leaves a superseded render's frame dirs and videos
 * lingering under `renders/` with nothing listing them. The project summary now
 * carries `staleRenders` — top-level `renders/` entries owned by neither the
 * committed film's stem family, nor any committed shot's, nor a registered
 * asset. Detection is the server's; the corrective action stays the agent's.
 *
 * Scenarios (resident project, film committed):
 *
 * 1. A stray frame dir and a stray video from a DIFFERENT stem are listed in
 *    filename order.
 * 2. Negative twins: the current film's own frame dir and tagged outputs, a
 *    committed shot's preview dir, and a registered stray are never listed.
 * 3. While no film is committed the ledger stays empty — even with strays on disk
 *    (mid-rework, ownership is undefined).
 */
export const test_mcp_stale_render_ledger = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-stale-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    app.commitScript({ script });
    app.commitScene({ scene, models: [] });
    app.commitShot({ shot });

    // strays on disk BEFORE the film exists
    const renders = path.join(root, "renders");
    fs.mkdirSync(path.join(renders, "seq-old"), { recursive: true });
    fs.writeFileSync(path.join(renders, "seq-old", "frame_00000.png"), "x");
    fs.writeFileSync(path.join(renders, "seq-old.mp4"), "x");
    fs.writeFileSync(path.join(renders, "kept.mp4"), "x");

    // 3. no film committed → empty ledger despite the strays
    TestValidator.equals(
      "no film means an empty ledger",
      app.nextSteps().status.staleRenders,
      [],
    );

    app.commitFilm({
      review: "one beat plays whole; the ledger fixture is ready",
      film,
    });

    // live outputs the current truth owns
    fs.mkdirSync(path.join(renders, "seq-live"), { recursive: true });
    fs.writeFileSync(path.join(renders, "seq-live.mp4"), "x");
    fs.writeFileSync(path.join(renders, "seq-live.concat.txt"), "x");
    // a committed shot's preview dir ("shot:beat-1" stems to "shot_beat-1")
    fs.mkdirSync(path.join(renders, "shot_beat-1"), { recursive: true });
    app.registerAsset({ path: "renders/kept.mp4" });

    // 1 + 2. only the unowned strays are listed, in filename order
    TestValidator.equals(
      "only the superseded stem's outputs are stale",
      app.nextSteps().status.staleRenders,
      ["renders/seq-old", "renders/seq-old.mp4"],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
