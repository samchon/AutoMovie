import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieProject, IAutoMovieMcpWritableSlate } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script: IAutoMovieScript = {
  logline: "a door opens",
  theme: "curiosity",
  cast: [],
  beats: [
    { id: "b1", name: "open", summary: "the door opens", durationHint: 2 },
  ],
};

const shot: IAutoMovieShot = {
  id: "shot:b1",
  name: null,
  scene: "scene-1",
  camera: "cam",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const slateWith = (
  partial: Partial<IAutoMovieMcpWritableSlate>,
): IAutoMovieMcpWritableSlate => ({
  script: null,
  scene: null,
  shots: [],
  beatEnds: [],
  notes: [],
  film: null,
  ...partial,
});

/**
 * The project folder itself is the memory (#614): opening a fresh directory is
 * a valid empty project, a saved slate becomes visible pretty-printed JSON
 * files, reopening reads the same state back, and reconciliation mirrors the
 * commit tools' invalidation cascade as files disappearing.
 *
 * Scenarios:
 *
 * 1. Opening a fresh temp dir initializes the tree (manifest + reserved dirs) and
 *    reports an empty summary.
 * 2. Saving a slate persists slices as human-readable JSON; a REOPENED project (a
 *    new instance over the same root) reads the identical slate back —
 *    durability, not in-process caching.
 * 3. The shot slice file is itself valid pretty JSON whose parse equals the
 *    committed shot (the user-visible file IS the state).
 * 4. Re-saving with cleared downstream slices REMOVES their files (null script
 *    file gone, empty notes file gone, shots dir reconciled) — presence always
 *    means content.
 */
export const test_mcp_project_store = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-store-"));
  try {
    const project = AutoMovieProject.open(root);
    TestValidator.equals(
      "fresh project is empty",
      project.summary().script,
      false,
    );
    TestValidator.equals(
      "manifest exists",
      fs.existsSync(path.join(root, "automovie.json")),
      true,
    );
    TestValidator.equals(
      "reserved dirs exist",
      fs.existsSync(path.join(root, "models")) &&
        fs.existsSync(path.join(root, "renders")),
      true,
    );

    project.saveSlate(
      slateWith({
        script,
        shots: [shot],
        notes: [{ beat: "b1", tier: "physical", issue: "x", suggestion: "y" }],
      }),
    );
    const reopened = AutoMovieProject.open(root).writableSlate();
    TestValidator.equals("reopened script survives", reopened.script, script);
    TestValidator.equals("reopened shots survive", reopened.shots, [shot]);
    TestValidator.equals("reopened notes survive", reopened.notes.length, 1);

    const shotFile = path.join(root, "shots", "b1.json");
    TestValidator.equals(
      "shot slice file parse equals the shot",
      JSON.parse(fs.readFileSync(shotFile, "utf8")),
      shot,
    );

    AutoMovieProject.open(root).saveSlate(slateWith({ script }));
    TestValidator.equals(
      "cleared shots dir reconciled",
      fs.existsSync(shotFile),
      false,
    );
    TestValidator.equals(
      "empty notes file removed",
      fs.existsSync(path.join(root, "notes.json")),
      false,
    );
    TestValidator.equals(
      "script file kept",
      fs.existsSync(path.join(root, "script.json")),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
