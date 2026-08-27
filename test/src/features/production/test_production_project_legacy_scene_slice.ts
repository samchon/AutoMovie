import { IAutoMovieScene } from "@automovie/interface";
import { AutoMovieProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface ILegacySceneFixtureFailure {
  error: unknown;
}

class LegacySceneFixtureCleanupError extends AggregateError {}

/** Remove the legacy-scene root without replacing its primary failure. */
const preserveLegacySceneFixtureCleanup = (
  failure: ILegacySceneFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new LegacySceneFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Legacy-scene fixture cleanup failed after the test failed.",
    );
  }
};

const scene: IAutoMovieScene = {
  id: "scene-1",
  name: "a door",
  nodes: [],
  cameras: [],
  lights: [],
  space: null,
};

/**
 * A project written before the slate held several scenes still opens, and the
 * first write moves it into the keyed layout.
 *
 * The staged scene used to be one `scene.json`; it is now `scenes/<id>.json`,
 * one slice per location, because a film is not one set (#1171). A project on
 * disk from before that change is still a film, so it is read rather than
 * refused: the legacy slice loads as a one-element collection, and `saveSlate`
 * writes it into the directory and removes the old file. Refusing instead would
 * strand every project authored before the change, and reading without
 * migrating would leave two places holding the same scene.
 *
 * Scenarios:
 *
 * 1. A project whose only staged scene is a legacy `scene.json` opens with that
 *    scene in `scenes`, byte-identical to what was written.
 * 2. Saving that slate writes `scenes/<id>.json` and removes `scene.json`, and
 *    reopening reads the same scene from the new layout.
 * 3. The keyed layout wins when both exist: a `scene.json` left behind by a
 *    half-finished migration is ignored rather than merged, so a stale copy
 *    cannot resurrect a scene the project has since replaced.
 */
export const test_production_project_legacy_scene_slice = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-legacy-"));
  let legacySceneFailure: ILegacySceneFixtureFailure | undefined;
  try {
    AutoMovieProject.open(root);
    const legacy = path.join(root, "scene.json");
    fs.writeFileSync(legacy, `${JSON.stringify(scene, null, 2)}\n`);

    // 1. the legacy slice reads as a one-element collection
    const opened = AutoMovieProject.open(root);
    TestValidator.equals(
      "the legacy scene slice loads",
      opened.storedSlate().scenes,
      [scene],
    );

    // 2. writing migrates it into the keyed layout
    opened.saveSlate({ ...opened.writableSlate(), film: null });
    TestValidator.equals(
      "the keyed slice replaces the legacy file",
      [
        fs.existsSync(path.join(root, "scenes", `${scene.id}.json`)),
        fs.existsSync(legacy),
      ],
      [true, false],
    );
    TestValidator.equals(
      "reopening reads the migrated scene",
      AutoMovieProject.open(root).storedSlate().scenes,
      [scene],
    );

    // 3. a leftover legacy file never shadows the keyed layout
    const replaced: IAutoMovieScene = { ...scene, name: "a door, repainted" };
    const project = AutoMovieProject.open(root);
    project.saveSlate({ ...project.writableSlate(), scenes: [replaced] });
    fs.writeFileSync(legacy, `${JSON.stringify(scene, null, 2)}\n`);
    TestValidator.equals(
      "the keyed layout wins over a stale legacy file",
      AutoMovieProject.open(root).storedSlate().scenes,
      [replaced],
    );
  } catch (error) {
    legacySceneFailure = { error };
    throw error;
  } finally {
    preserveLegacySceneFixtureCleanup(legacySceneFailure, () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
  }
};
