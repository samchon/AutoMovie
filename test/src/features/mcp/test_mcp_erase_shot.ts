import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, throwsError } from "../internal/predicates";

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

const makeShot = (beat: string, scene: string): IAutoMovieShot => ({
  id: `shot:${beat}`,
  name: null,
  scene,
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
});

/**
 * EraseShot (#617): a targeted, evidence-backed removal of ONE beat's shot —
 * never a reset. The cascade mirrors the commit tools' invalidation: the beat's
 * beat-end and its beat-scoped review notes are stale without their shot and go
 * with it; sibling beats are untouched on disk.
 *
 * Scenarios:
 *
 * 1. Erasing beat-1 removes `shots/beat-1.json`, `beatEnds/beat-1.json`, and
 *    beat-1's notes from `notes.json`, while beat-2's shot and beat-end files
 *    stay byte-identical and beat-2's note survives.
 * 2. Erasing a beat with no committed shot or a malformed beat scalar is a
 *    violation located at `$input.beat` — the erase names a mistake that must
 *    exist.
 * 3. An empty reason is a violation (evidence discipline); the slate is unchanged
 *    and no file is touched.
 * 4. Without an active project the tool throws the actionable openProject guidance
 *    (erase is resident-only).
 */
export const test_mcp_erase_shot = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-erase-"));
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
    app.commitShot({ shot: makeShot("beat-1", staged.scene.id) });
    app.commitShot({ shot: makeShot("beat-2", staged.scene.id) });
    app.commitBeatEnd({
      beatEnd: { beat: "beat-1", shot: "shot:beat-1", actors: [] },
    });
    app.commitBeatEnd({
      beatEnd: { beat: "beat-2", shot: "shot:beat-2", actors: [] },
    });
    app.commitNotes({
      notes: [
        {
          beat: "beat-1",
          tier: "visual",
          issue: "the charge drifts",
          suggestion: "restage the approach",
        },
        {
          beat: "beat-2",
          tier: "physical",
          issue: "blades interpenetrate",
          suggestion: "widen the clash",
        },
      ],
    });

    const shot2File = path.join(root, "shots", "beat-2.json");
    const end2File = path.join(root, "beatEnds", "beat-2.json");
    const shot2Before = fs.readFileSync(shot2File, "utf8");
    const end2Before = fs.readFileSync(end2File, "utf8");

    const malformedRequest = app.eraseShot(null as never);
    TestValidator.equals(
      "malformed request root refused",
      malformedRequest.erased,
      false,
    );
    TestValidator.predicate(
      "malformed request root located",
      hasViolation(malformedRequest.validation, "type", "$input"),
    );
    TestValidator.equals(
      "malformed request keeps the slate",
      malformedRequest.slate.shots.length,
      2,
    );

    const erased = app.eraseShot({
      beat: "beat-1",
      reason: "the charge was staged against the wrong camera",
    });
    TestValidator.equals("erase applies", erased.erased, true);
    TestValidator.equals(
      "beat-1's shot file removed",
      fs.existsSync(path.join(root, "shots", "beat-1.json")),
      false,
    );
    TestValidator.equals(
      "beat-1's beat-end removed with it",
      fs.existsSync(path.join(root, "beatEnds", "beat-1.json")),
      false,
    );
    TestValidator.equals(
      "beat-1's notes removed with it",
      erased.slate.notes.some((note) => note.beat === "beat-1"),
      false,
    );
    TestValidator.equals(
      "beat-2's note survives",
      erased.slate.notes.some((note) => note.beat === "beat-2"),
      true,
    );
    TestValidator.equals(
      "sibling shot file byte-identical",
      fs.readFileSync(shot2File, "utf8"),
      shot2Before,
    );
    TestValidator.equals(
      "sibling beat-end file byte-identical",
      fs.readFileSync(end2File, "utf8"),
      end2Before,
    );

    const missing = app.eraseShot({ beat: "beat-9", reason: "typo" });
    TestValidator.equals("nonexistent shot refused", missing.erased, false);
    TestValidator.predicate(
      "violation located at the beat",
      hasViolation(missing.validation, "type", "$input.beat"),
    );
    const malformedBeat = app.eraseShot({
      beat: null as unknown as string,
      reason: "reject malformed beat input",
    });
    TestValidator.equals("malformed beat refused", malformedBeat.erased, false);
    TestValidator.predicate(
      "malformed beat located",
      hasViolation(malformedBeat.validation, "type", "$input.beat"),
    );

    const before = fs.readFileSync(shot2File, "utf8");
    const noReason = app.eraseShot({ beat: "beat-2", reason: "  " });
    TestValidator.equals("empty reason refused", noReason.erased, false);
    TestValidator.predicate(
      "violation located at the reason",
      hasViolation(noReason.validation, "type", "$input.reason"),
    );
    TestValidator.equals(
      "refused erase touches nothing",
      fs.readFileSync(shot2File, "utf8"),
      before,
    );

    const orphan = new AutoMovieApplication();
    TestValidator.predicate(
      "erase is resident-only",
      throwsError(
        () => orphan.eraseShot({ beat: "beat-1", reason: "x" }),
        "openProject",
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
