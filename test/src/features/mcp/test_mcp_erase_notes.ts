import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

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
 * EraseNotes (#617): per-beat note removal — notes carry no ids, so the beat is
 * their identity anchor and the minimal addressable granularity. Evidence
 * required; erasing a beat with no notes is a violation.
 *
 * Scenarios:
 *
 * 1. Erasing beat-1's notes leaves beat-2's note in the slate and in `notes.json`.
 * 2. Erasing them again (now none exist) is a violation located at `$input.beat` —
 *    the twin proving the existence gate.
 * 3. An empty reason is a violation and changes nothing.
 */
export const test_mcp_erase_notes = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-erasenotes-"));
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

    const malformedRequest = app.eraseNotes(null as never);
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
      "malformed request keeps notes",
      malformedRequest.slate.notes.map((note) => note.beat),
      ["beat-1", "beat-2"],
    );

    const erased = app.eraseNotes({
      beat: "beat-1",
      reason: "note resolved by the restaged approach",
    });
    TestValidator.equals("erase applies", erased.erased, true);
    TestValidator.equals(
      "only beat-2's note remains",
      erased.slate.notes.map((note) => note.beat),
      ["beat-2"],
    );
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(root, "notes.json"), "utf8"),
    ) as Array<{ beat: string }>;
    TestValidator.equals(
      "notes.json mirrors the erase",
      onDisk.map((note) => note.beat),
      ["beat-2"],
    );

    const again = app.eraseNotes({ beat: "beat-1", reason: "double tap" });
    TestValidator.equals("nothing left to erase", again.erased, false);
    TestValidator.predicate(
      "violation located at the beat",
      hasViolation(again.validation, "type", "$input.beat"),
    );
    const malformedBeat = app.eraseNotes({
      beat: null as unknown as string,
      reason: "reject malformed beat input",
    });
    TestValidator.equals("malformed beat refused", malformedBeat.erased, false);
    TestValidator.predicate(
      "malformed beat located",
      hasViolation(malformedBeat.validation, "type", "$input.beat"),
    );

    const noReason = app.eraseNotes({ beat: "beat-2", reason: "" });
    TestValidator.equals("empty reason refused", noReason.erased, false);
    TestValidator.predicate(
      "violation located at the reason",
      hasViolation(noReason.validation, "type", "$input.reason"),
    );
    TestValidator.equals(
      "refused erase changes nothing",
      noReason.slate.notes.map((note) => note.beat),
      ["beat-2"],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
