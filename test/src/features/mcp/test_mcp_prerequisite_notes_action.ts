import {
  IAutoMovieScene,
  IAutoMovieScript,
  IAutoMovieShot,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { IDENTITY_TRANSFORM, createSkeleton } from "../internal/fixtures";

const skeleton = createSkeleton();

const script: IAutoMovieScript = {
  logline: "a resident film with an open review note",
  theme: "resolve the note before the film",
  cast: [{ node: "actor", character: "the actor", modelRef: null }],
  beats: [
    {
      id: "beat-1",
      name: "the beat",
      summary: "the actor waits",
      durationHint: 1,
    },
  ],
};

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: null,
  nodes: [
    {
      id: "actor",
      model: "actor-model",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
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

/**
 * The resident `nextSteps` ladder surfaces open review notes as a concrete next
 * action (#1040 coverage): once script, scene, and the beat's shot are
 * committed, an open note makes `nextSteps` prescribe clearing it with
 * `commitNotes` before the film can be assembled.
 *
 * Scenarios:
 *
 * 1. With script/scene/shot committed and one open note, `nextSteps` lists the
 *    "resolve and clear the open review note(s)" action.
 * 2. Negative twin: after the note is cleared, that action is gone and the ladder
 *    advances to the film.
 */
export const test_mcp_prerequisite_notes_action = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-notes-next-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    app.commitScript({ script });
    app.commitScene({
      scene,
      models: [{ id: "actor-model", skeleton }],
    });
    app.commitShot({ shot });
    app.commitNotes({
      notes: [
        {
          beat: "beat-1",
          tier: "structural",
          issue: "the beat reads flat",
          suggestion: "sharpen the beat",
        },
      ],
    });

    const withNote = app.nextSteps();
    TestValidator.predicate(
      "nextSteps prescribes clearing the open review note",
      withNote.nextActions.some((action) =>
        action.includes("open review note"),
      ),
    );

    app.commitNotes({ notes: [] });
    const cleared = app.nextSteps();
    TestValidator.predicate(
      "once the note is cleared the notes action is gone",
      !cleared.nextActions.some((action) =>
        action.includes("open review note"),
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
