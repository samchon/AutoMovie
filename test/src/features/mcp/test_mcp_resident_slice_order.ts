import { IAutoMovieScript, IAutoMovieShot } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";

// Beats whose commit order (beat-2, then beat-10) differs from their stored
// filename order: "beat-10.json" < "beat-2.json" (char 5: "1" < "2"), so the
// canonical read order is [beat-10, beat-2] while an append would leave
// [beat-2, beat-10]. The exact case that exposed the cross-mode divergence.
const scriptWrite = makeScriptWrite({
  beats: [
    { id: "beat-2", name: "second", summary: "s", durationHint: 1 },
    { id: "beat-10", name: "tenth", summary: "t", durationHint: 1 },
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
 * Resident slice arrays come back in the stored filename order, not the upsert
 * append order (#716). `readKeyedSlices` reads `shots/`/`beatEnds/` in
 * filename-lexicographic order, but a `commitShot`/`commitBeatEnd` upsert
 * appends a new beat at the array end, so the slate a resident commit returned
 * was NOT byte-identical to what the next resident read produced, breaking the
 * "same logical state, same bytes" expectation a caller that diffs or caches
 * the returned slate relies on. `finish` now reorders the resident-committed
 * slate through the store's canonical filename order, closing the gap.
 *
 * Scenarios (beats committed beat-2 then beat-10, whose filename order is the
 * reverse):
 *
 * 1. The last resident commitShot returns shots in filename order [shot:beat-10,
 *    shot:beat-2]. The reordering actually happened (not the [beat-2, beat-10]
 *    append order).
 * 2. That returned order equals the next resident read's order
 *    (`nextSteps().status.shots`): cross-mode byte consistency.
 * 3. The same holds for beatEnds committed in the reverse-of-filename order.
 * 4. An explicit-slate commit is a pure transform: it preserves the caller's given
 *    shot order verbatim (no reordering, byte-compat).
 */
export const test_mcp_resident_slice_order = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-order-"));
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

    // Commit in the order beat-2, then beat-10: the append order.
    app.commitShot({ shot: makeShot("beat-2", staged.scene.id) });
    const lastShot = app.commitShot({
      shot: makeShot("beat-10", staged.scene.id),
    });

    const filenameOrder = ["shot:beat-10", "shot:beat-2"];
    TestValidator.equals(
      "resident commit returns shots in filename order, not append order",
      lastShot.state.shots,
      filenameOrder,
    );
    TestValidator.equals(
      "commit-returned order equals the next resident read order",
      app.nextSteps().status.shots,
      filenameOrder,
    );

    // Beat-ends: commit beat-2 then beat-10 (append), expect filename order.
    app.commitBeatEnd({
      beatEnd: { beat: "beat-2", shot: "shot:beat-2", actors: [] },
    });
    const lastEnd = app.commitBeatEnd({
      beatEnd: { beat: "beat-10", shot: "shot:beat-10", actors: [] },
    });
    TestValidator.equals(
      "resident commit returns beatEnds in filename order",
      lastEnd.state.beatEnds,
      ["beat-10", "beat-2"],
    );
    TestValidator.equals(
      "beatEnd order matches the next resident read order",
      app.nextSteps().status.beatEnds,
      ["beat-10", "beat-2"],
    );

    // Explicit-slate commit stays a pure transform: caller order preserved.
    const explicit = app.commitShot({
      slate: {
        script,
        scene: staged.scene,
        shots: [makeShot("beat-2", staged.scene.id)],
        beatEnds: [],
        notes: [],
        film: null,
      },
      shot: makeShot("beat-10", staged.scene.id),
    });
    TestValidator.equals(
      "explicit slate preserves the caller's shot order (append, no reorder)",
      explicit.slate!.shots.map((shot) => shot.id),
      ["shot:beat-2", "shot:beat-10"],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
