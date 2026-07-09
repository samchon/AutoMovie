import { IAutoMovieScript } from "@automovie/interface";
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
 * Resident commits (#614): once a project is open, commit tools omitting their
 * slate transform the RESIDENT slate and write through — the project files
 * mirror the returned slate, including the upstream-edit invalidation cascade.
 * An explicit slate keeps the tool a pure transform that never touches the
 * project.
 *
 * Scenarios:
 *
 * 1. OpenProject on a fresh dir reports an empty project.
 * 2. CommitScript with no slate commits into the resident project: `script.json`
 *    appears and its parse equals the script.
 * 3. CommitScene with no slate reads the resident script as its base (the
 *    cross-slice precondition holds without re-sending state) and persists
 *    `scene.json`.
 * 4. Re-committing the script clears the downstream scene — the invalidation
 *    cascade is visible as `scene.json` disappearing.
 * 5. A commit with an EXPLICIT slate does not touch the resident files (the
 *    stateless twin), and a failed resident commit writes nothing.
 * 6. A malformed `openProject` request root rejects before reading `root`.
 */
export const test_mcp_project_resident_commit = (): void => {
  TestValidator.predicate(
    "malformed openProject request root rejects",
    throwsError(
      () => new AutoMovieApplication().openProject(null as never),
      ["$input", "JSON object"],
    ),
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-resident-"));
  try {
    const app = new AutoMovieApplication();
    const opened = app.openProject({ root });
    TestValidator.equals("fresh project empty", opened.project.script, false);

    const committed = app.commitScript({ script });
    TestValidator.equals("resident commit succeeds", committed.committed, true);
    const scriptFile = path.join(root, "script.json");
    TestValidator.equals(
      "script.json mirrors the committed script",
      JSON.parse(fs.readFileSync(scriptFile, "utf8")),
      script,
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
    const sceneCommit = app.commitScene({ scene: staged.scene, models });
    TestValidator.equals(
      "resident scene commit uses the resident script",
      sceneCommit.committed,
      true,
    );
    const sceneFile = path.join(root, "scene.json");
    TestValidator.equals("scene.json appears", fs.existsSync(sceneFile), true);

    app.commitScript({ script: { ...script, theme: "second draft" } });
    TestValidator.equals(
      "upstream re-commit clears the downstream scene file",
      fs.existsSync(sceneFile),
      false,
    );

    const before = fs.readFileSync(scriptFile, "utf8");
    const explicit = app.commitScript({
      slate: {
        script: null,
        scene: null,
        shots: [],
        beatEnds: [],
        notes: [],
        film: null,
      },
      script: { ...script, theme: "explicit fork" },
    });
    TestValidator.equals("explicit commit succeeds", explicit.committed, true);
    TestValidator.equals(
      "explicit slate never touches the project",
      fs.readFileSync(scriptFile, "utf8"),
      before,
    );

    const failed = app.commitScript({
      script: { ...script, logline: "" },
    });
    TestValidator.equals(
      "bad resident commit refuses",
      failed.committed,
      false,
    );
    TestValidator.equals(
      "failed commit writes nothing",
      fs.readFileSync(scriptFile, "utf8"),
      before,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
