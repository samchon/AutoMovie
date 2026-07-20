import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";

const scriptWrite = makeScriptWrite({
  beats: [
    {
      id: "beat-1",
      name: "the charge",
      summary: "knightA charges knightB",
      durationHint: 3,
    },
    {
      id: "beat-2",
      name: "the clash",
      summary: "steel meets steel",
      durationHint: 2,
    },
  ],
});
const script: IAutoMovieScript = {
  logline: scriptWrite.logline,
  theme: scriptWrite.theme,
  cast: scriptWrite.cast,
  beats: scriptWrite.beats,
};

const makeShot = (
  beat: string,
  duration: number,
  scene: string,
): IAutoMovieShot => ({
  id: `shot:${beat}`,
  name: null,
  scene,
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration,
});

/**
 * The upsert rule (#617, the AutoBe granularity doctrine): re-committing the
 * same beat's artifact replaces exactly that slice (and, resident, exactly that
 * file), leaving sibling beats byte-identical. One beat is the stable
 * correction target.
 *
 * Scenarios:
 *
 * 1. Two beats' shots commit into the resident project as two files.
 * 2. Re-committing beat-1's shot with changed content replaces `shots/beat-1
 *    .json` (the parse shows the new duration) while `shots/beat-2.json` stays
 *    byte-identical: the upsert touched one slice only.
 * 3. The re-commit invalidates ONLY beat-1's beat-end (commitShot's cascade):
 *    `beatEnds/beat-1.json` disappears, `beatEnds/beat-2.json` survives
 *    byte-identical.
 * 4. The slate's shot count stays 2 after the re-commit: replacement, not append
 *    (the negative twin of an accidental duplicate).
 */
export const test_mcp_commit_upsert = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-upsert-"));
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

    app.commitShot({ shot: makeShot("beat-1", 1, staged.scene.id) });
    app.commitShot({ shot: makeShot("beat-2", 2, staged.scene.id) });
    app.commitBeatEnd({
      beatEnd: { beat: "beat-1", shot: "shot:beat-1", actors: [] },
    });
    app.commitBeatEnd({
      beatEnd: { beat: "beat-2", shot: "shot:beat-2", actors: [] },
    });

    const shot1File = path.join(root, "shots", "beat-1.json");
    const shot2File = path.join(root, "shots", "beat-2.json");
    const end1File = path.join(root, "beatEnds", "beat-1.json");
    const end2File = path.join(root, "beatEnds", "beat-2.json");
    const shot2Before = fs.readFileSync(shot2File, "utf8");
    const end2Before = fs.readFileSync(end2File, "utf8");

    const recommit = app.commitShot({
      shot: makeShot("beat-1", 9, staged.scene.id),
    });
    TestValidator.equals("re-commit succeeds", recommit.committed, true);
    TestValidator.equals(
      "beat-1's file carries the replacement",
      (JSON.parse(fs.readFileSync(shot1File, "utf8")) as IAutoMovieShot)
        .duration,
      9,
    );
    TestValidator.equals(
      "sibling beat-2's shot file is byte-identical",
      fs.readFileSync(shot2File, "utf8"),
      shot2Before,
    );
    TestValidator.equals(
      "only beat-1's beat-end is invalidated",
      fs.existsSync(end1File),
      false,
    );
    TestValidator.equals(
      "sibling beat-2's beat-end survives byte-identical",
      fs.readFileSync(end2File, "utf8"),
      end2Before,
    );
    TestValidator.equals(
      "replacement, not append",
      recommit.state.shots.length,
      2,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
