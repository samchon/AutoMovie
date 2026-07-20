import { IAutoMovieScript } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
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

const emptySlate: IAutoMovieMcpWritableSlate = {
  script: null,
  scene: null,
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
};

/**
 * The resident commit gate (#615): an out-of-order commit against the resident
 * project THROWS the actionable "do this next" prompt before any transform runs
 *, the AutoBe prerequisite convention over automovie's film ladder. The gate
 * is resident-only: an explicit slate stays the stateless pure transform whose
 * cross-slice preconditions surface as violations, exactly as before.
 *
 * Scenarios:
 *
 * 1. CommitScene on a fresh project throws the pinned prompt: it names the tool
 *    ("Cannot commitScene yet."), lists the missing script, and orders the next
 *    action ("1. Call commitScript …").
 * 2. CommitFilm on the same fresh project lists ALL THREE missing rungs in ladder
 *    order, numbered 1..3.
 * 3. After commitScript, commitShot still throws, now naming only the missing
 *    scene (the satisfied script no longer appears in "Missing").
 * 4. The stateless twin: the same out-of-order commitScene with an EXPLICIT empty
 *    slate does not throw, it returns `committed: false` with the precondition
 *    violation, byte-identical to the pre-#615 behavior.
 * 5. Without any active project, the resident call still fails with the
 *    openProject guidance (requireProject fires before the gate).
 */
export const test_mcp_prerequisites_gate = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-prereq-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });

    TestValidator.predicate(
      "out-of-order commitScene throws the actionable prompt",
      throwsError(
        () => app.commitScene({ scene: null as never, models: [] }),
        [
          "Cannot commitScene yet.",
          "Missing prerequisite(s):",
          "- script: no script committed, commit one with commitScript",
          "Do this next:",
          "1. Call commitScript with the film's script",
        ],
      ),
    );

    TestValidator.predicate(
      "commitFilm lists all three missing rungs in ladder order",
      throwsError(
        () => app.commitFilm({ review: "x", film: null as never }),
        [
          "Cannot commitFilm yet.",
          "1. Call commitScript",
          "2. Call commitScene",
          "3. Call commitShot",
        ],
      ),
    );

    app.commitScript({ script });
    TestValidator.predicate(
      "after the script, commitShot names only the missing scene",
      throwsError(
        () => app.commitShot({ shot: null as never }),
        [
          "Cannot commitShot yet.",
          "- Script: committed",
          "- scene: no staged scene committed",
          "1. Call commitScene",
        ],
      ),
    );

    const staged = app.stage({
      script: scriptWrite,
      staging: makeStagingWrite(),
    }).staged;
    if (staged.success !== true)
      throw new Error("staging fixture must succeed");
    const explicit = app.commitScene({
      slate: emptySlate,
      scene: staged.scene,
      models: [],
    });
    TestValidator.equals(
      "explicit-slate commit bypasses the gate (violation, not throw)",
      explicit.committed,
      false,
    );

    const orphan = new AutoMovieApplication();
    TestValidator.predicate(
      "no project → the openProject guidance fires first",
      throwsError(
        () => orphan.commitScene({ scene: staged.scene, models: [] }),
        "Call openProject",
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
