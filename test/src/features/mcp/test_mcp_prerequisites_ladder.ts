import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";

const scriptWrite = makeScriptWrite();
const script: IAutoMovieScript = {
  logline: scriptWrite.logline,
  theme: scriptWrite.theme,
  cast: scriptWrite.cast,
  beats: scriptWrite.beats,
};

/**
 * The in-order resident ladder sails through the prerequisite gate (#615): a
 * project that commits script → scene → shot in order never sees the gate, and
 * each commit behaves exactly as #614 left it (write-through, cascade). The
 * gate only bites out-of-order calls.
 *
 * Scenarios:
 *
 * 1. CommitScript on a fresh project passes (its prerequisite set is empty; the
 *    ladder must be enterable).
 * 2. CommitScene after the script passes the gate and commits.
 * 3. CommitShot after the scene passes the gate and commits (a minimal valid shot
 *    against the staged scene).
 * 4. CommitNotes, gated on shots, now passes too, proving the coarse rungs unlock
 *    in order.
 */
export const test_mcp_prerequisites_ladder = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-ladder-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });

    const scripted = app.commitScript({ script });
    TestValidator.equals("script enters the ladder", scripted.committed, true);

    const staged = app.stage({
      script: scriptWrite,
      staging: makeStagingWrite(),
    }).staged;
    if (staged.success !== true)
      throw new Error("staging fixture must succeed");
    const models = [
      ...new Set(staged.scene.nodes.map((node) => node.model)),
    ].map((id) => ({ id, skeleton: null }));
    const scened = app.commitScene({ scene: staged.scene, models });
    TestValidator.equals("scene passes the gate", scened.committed, true);

    const shot: IAutoMovieShot = {
      id: `shot:${script.beats[0]!.id}`,
      name: null,
      scene: staged.scene.id,
      camera: "cam-main",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
      duration: 1,
    };
    const shotted = app.commitShot({ shot });
    TestValidator.equals("shot passes the gate", shotted.committed, true);

    const noted = app.commitNotes({ notes: [] });
    TestValidator.equals(
      "notes unlock once a shot exists",
      noted.committed,
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
