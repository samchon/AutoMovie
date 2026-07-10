import { IAutoMovieScript } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { throwsError } from "../internal/predicates";

/**
 * The film-ladder prerequisite gate (#615): a resident commit called out of
 * order throws the actionable "do this next" prompt BEFORE any transform runs,
 * naming the tool, every missing rung, and the ordered actions — so an agent
 * that skipped a rung is told exactly how to recover instead of decoding a
 * violation. Explicit-slate calls bypass the gate (pure transforms), so only
 * the resident path is pinned here (#1040).
 *
 * Scenarios (fresh resident project):
 *
 * 1. `commitScene` with no script throws naming the tool, the missing script rung,
 *    and the commitScript action.
 * 2. `commitBeatEnd` on an empty project lists ALL THREE missing rungs in ladder
 *    order (script → scene → shots), with the ordered next actions.
 * 3. Negative twin: after commitScript, `commitScene` passes the gate (the scene
 *    commit itself succeeds), and `commitFilm` then reports only the
 *    still-missing shots rung.
 */
export const test_mcp_prerequisite_ladder = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-ladder-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
    const scriptWrite = makeScriptWrite();
    const script: IAutoMovieScript = {
      logline: scriptWrite.logline,
      theme: scriptWrite.theme,
      cast: scriptWrite.cast,
      beats: scriptWrite.beats,
    };
    const staged = app.stage({
      script: scriptWrite,
      staging: makeStagingWrite(),
    }).staged;
    if (staged.success !== true)
      throw new Error("staging fixture must succeed");
    const models = [
      ...new Set(staged.scene.nodes.map((node) => node.model)),
    ].map((id) => ({ id, skeleton: null }));

    // 1. commitScene before the script names the rung and the fix
    TestValidator.predicate(
      "commitScene before the script throws the actionable prompt",
      throwsError(
        () => app.commitScene({ scene: staged.scene, models }),
        [
          "Cannot commitScene yet.",
          "script: no script committed — commit one with commitScript",
          "1. Call commitScript",
        ],
      ),
    );

    // 2. commitBeatEnd on the empty ladder lists all three rungs in order
    TestValidator.predicate(
      "commitBeatEnd lists every missing rung in ladder order",
      throwsError(
        () =>
          app.commitBeatEnd({
            beatEnd: { beat: "beat-1", shot: "shot:beat-1", actors: [] },
          }),
        [
          "Cannot commitBeatEnd yet.",
          "script: no script committed",
          "scene: no staged scene committed",
          "shots: no shots committed",
          "3. Call commitShot",
        ],
      ),
    );

    // 3. negative twin: each committed rung leaves only the rungs above it
    app.commitScript({ script });
    const scene = app.commitScene({ scene: staged.scene, models });
    TestValidator.equals(
      "the gate opens once the script rung is committed",
      scene.committed,
      true,
    );
    TestValidator.predicate(
      "commitFilm now reports only the missing shots rung",
      throwsError(
        () =>
          app.commitFilm({
            film: {
              id: "seq-1",
              name: null,
              fps: 24,
              shots: [{ shot: "shot:beat-1", trim: null, transition: null }],
            },
          }),
        ["Cannot commitFilm yet.", "shots: no shots committed"],
      ) &&
        !throwsError(
          () =>
            app.commitFilm({
              film: {
                id: "seq-1",
                name: null,
                fps: 24,
                shots: [{ shot: "shot:beat-1", trim: null, transition: null }],
              },
            }),
          ["script: no script committed"],
        ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
