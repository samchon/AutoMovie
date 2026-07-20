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
 * Erase and the prerequisite ladder (#617 × #615): removing the last shot flips
 * the ladder's `shots` rung back off: the film's ordering state is derived from
 * the files, so an erase honestly re-locks what depended on the erased
 * artifact, and nextSteps names the re-do.
 *
 * Scenarios:
 *
 * 1. With one shot committed, nextSteps reports no missing rungs.
 * 2. Erasing that shot flips `shots` back into the missing list, and nextActions
 *    names committing the beat's shot again.
 * 3. A commit gated on shots (commitNotes) now throws the prerequisite prompt
 *    again: the twin proving the gate re-armed.
 * 4. An explicit-slate commitShot is untouched by all of this: it transforms its
 *    own slate and the project files stay as the erase left them.
 */
export const test_mcp_erase_ladder = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-eraseladder-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    app.commitScript({ script });

    const staged = app.stage({
      script: scriptWrite,
      staging: makeStagingWrite(),
    }).staged;
    if (staged.success !== true)
      throw new Error("staging fixture must succeed");
    const models = [
      ...new Set(staged.scene.nodes.map((node) => node.model)),
    ].map((id) => ({ id, skeleton: null }));
    app.commitScene({ scene: staged.scene, models });

    const shot: IAutoMovieShot = {
      id: "shot:beat-1",
      name: null,
      scene: staged.scene.id,
      camera: "cam-main",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
      duration: 1,
    };
    app.commitShot({ shot });
    TestValidator.equals(
      "ladder satisfied with the shot in place",
      app.nextSteps().missing,
      [],
    );

    app.eraseShot({ beat: "beat-1", reason: "wrong camera side" });
    const after = app.nextSteps();
    TestValidator.predicate(
      "shots rung re-locks after the erase",
      after.missing.some((line) => line.startsWith("shots:")),
    );
    TestValidator.predicate(
      "nextSteps names the re-do",
      after.nextActions.some((line) => line.includes("commitShot")),
    );

    let gated = false;
    try {
      app.commitNotes({ notes: [] });
    } catch (error) {
      gated =
        error instanceof Error &&
        error.message.includes("Cannot commitNotes yet");
    }
    TestValidator.equals("the prerequisite gate re-armed", gated, true);

    const shotFileGone = !fs.existsSync(
      path.join(root, "shots", "beat-1.json"),
    );
    const explicit = app.commitShot({
      slate: {
        script,
        scene: staged.scene,
        shots: [],
        beatEnds: [],
        notes: [],
        film: null,
      },
      shot,
    });
    TestValidator.equals(
      "explicit-slate commit is a pure transform",
      explicit.committed,
      true,
    );
    TestValidator.equals(
      "the project stays as the erase left it",
      !fs.existsSync(path.join(root, "shots", "beat-1.json")) && shotFileGone,
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
