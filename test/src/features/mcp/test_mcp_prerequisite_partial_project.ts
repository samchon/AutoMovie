import { IAutoMovieScene } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { IDENTITY_TRANSFORM, createSkeleton } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const skeleton = createSkeleton();

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

const write = (root: string, rel: string, value: unknown): void => {
  const file = path.join(root, ...rel.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

/**
 * The film-ladder prerequisite prompt reports EVERY rung's status, including a
 * committed film, even when an upstream rung is missing (#1040 coverage). A
 * partially-populated project, a committed film and its shot but no script ,
 * is a legitimate on-disk state a hand edit or a partial restore can produce;
 * `commitScene` there refuses with a prompt whose status block reads "Film:
 * committed" beside the missing script.
 *
 * Scenarios:
 *
 * 1. With `film.json` and its `shots/` slice present but no `script.json`,
 *    `commitScene` throws the prerequisite prompt naming the missing script
 *    rung while reporting the film as committed.
 */
export const test_mcp_prerequisite_partial_project = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-partial-"));
  try {
    // Scaffold the project tree and manifest.
    new AutoMovieApplication().openProject({ root });

    // A committed shot for beat-1 and a film that references it, but no script.
    write(root, "shots/beat-1.json", {
      id: "shot:beat-1",
      name: null,
      scene: "scene-1",
      camera: "camera",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
      duration: 1,
    });
    write(root, "film.json", {
      id: "seq-1",
      name: null,
      fps: 24,
      shots: [{ shot: "shot:beat-1", trim: null, transition: null }],
    });

    const app = new AutoMovieApplication();
    app.openProject({ root });
    TestValidator.predicate(
      "the prompt reports the committed film beside the missing script rung",
      throwsError(
        () =>
          app.commitScene({
            scene,
            models: [{ id: "actor-model", skeleton }],
          }),
        [
          "Cannot commitScene yet.",
          "Film: committed",
          "script: no script committed",
        ],
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
