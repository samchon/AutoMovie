import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { throwsError } from "../internal/predicates";

const scriptWrite = makeScriptWrite();
const script: IAutoMovieScript = {
  logline: scriptWrite.logline,
  theme: scriptWrite.theme,
  cast: scriptWrite.cast,
  beats: scriptWrite.beats,
};

/**
 * The `nextSteps` tool (#615): the film ladder as data — the same computation
 * the resident gate throws, exposed so an agent can ASK before trying. The
 * missing list mirrors the gate; the next actions walk the ladder with per-beat
 * detail once the coarse rungs are in.
 *
 * Scenarios:
 *
 * 1. Without an active project the tool fails with the openProject guidance.
 * 2. A fresh project misses every rung and its first action is commitScript — the
 *    same wording the gate's prompt orders.
 * 3. After the script, the first action becomes commitScene and the missing list
 *    no longer names the script.
 * 4. After the scene, the actions turn per-beat: one commitShot entry for every
 *    script beat still lacking a shot.
 * 5. After a shot commits, that beat's action flips to commitBeatEnd while the
 *    remaining beats still ask for their shots; the missing list is empty (all
 *    coarse rungs satisfied).
 */
export const test_mcp_next_steps = (): void => {
  const orphan = new AutoMovieApplication();
  TestValidator.predicate(
    "no project → openProject guidance",
    throwsError(() => orphan.nextSteps(), "Call openProject"),
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-next-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });

    const fresh = app.nextSteps();
    TestValidator.equals(
      "fresh project misses all coarse rungs",
      fresh.missing.length,
      3,
    );
    TestValidator.equals(
      "first action is commitScript",
      fresh.nextActions[0],
      "Call commitScript with the film's script (logline, theme, cast, beats).",
    );

    app.commitScript({ script });
    const afterScript = app.nextSteps();
    TestValidator.predicate(
      "script satisfied — missing list drops it",
      afterScript.missing.every((line) => !line.startsWith("script:")),
    );
    TestValidator.equals(
      "next action is commitScene",
      afterScript.nextActions[0],
      "Call commitScene with the staged scene (stage the script's cast with the stage tool first).",
    );

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

    const afterScene = app.nextSteps();
    TestValidator.equals(
      "per-beat shot actions, one per script beat",
      afterScene.nextActions,
      script.beats.map(
        (beat) =>
          `Call commitShot for beat "${beat.id}" (build it with block + perform).`,
      ),
    );

    const first = script.beats[0]!;
    const shot: IAutoMovieShot = {
      id: `shot:${first.id}`,
      name: null,
      scene: staged.scene.id,
      camera: "cam-main",
      cameraMotion: null,
      performances: [],
      objectMotions: [],
      duration: 1,
    };
    app.commitShot({ shot });

    const afterShot = app.nextSteps();
    TestValidator.equals(
      "all coarse rungs satisfied — missing empties",
      afterShot.missing,
      [],
    );
    TestValidator.predicate(
      "the committed beat flips to commitBeatEnd",
      afterShot.nextActions.includes(
        `Call commitBeatEnd for beat "${first.id}" so the next beat can resume from it.`,
      ),
    );
    TestValidator.predicate(
      "the other beats still ask for their shots",
      script.beats
        .slice(1)
        .every((beat) =>
          afterShot.nextActions.includes(
            `Call commitShot for beat "${beat.id}" (build it with block + perform).`,
          ),
        ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
