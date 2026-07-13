import {
  IAutoMovieBeatEndActorState,
  IAutoMovieBeatEndState,
} from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  makeBlockingWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation, throwsError } from "../internal/predicates";

const scriptWrite = makeScriptWrite({
  beats: [
    { id: "beat-1", name: "one", summary: "the charge", durationHint: 2 },
    { id: "beat-2", name: "two", summary: "the aftermath", durationHint: 2 },
  ],
});

const endActor = (node: string): IAutoMovieBeatEndActorState => ({
  node,
  transform: IDENTITY_TRANSFORM,
  facing: { x: 0, y: 0, z: 1 },
  pose: null,
  motion: null,
  localTime: 2,
  gaitPhase: null,
  rootVelocity: null,
  footPlants: null,
  mount: null,
});

const beatEnd = (beat: string): IAutoMovieBeatEndState => ({
  beat,
  shot: `shot:${beat}`,
  actors: [endActor("knightA"), endActor("knightB")],
});

/**
 * Resident `block` (#1176): omit `script` AND `staged` together and the beat
 * blocks against the committed slate — a long production stops re-sending the
 * staged scene every beat — and the previous beat's committed end-state (script
 * order) seeds `previous` automatically.
 *
 * Scenarios:
 *
 * 1. After resident commitScript/commitScene, a bare `block({ blocking })`
 *    succeeds; beat-1 has no predecessor, so `previous` is null.
 * 2. After committing beat-1's end-state, blocking beat-2 residentially auto-seeds
 *    `previous` with that committed state; an explicit `previous` overrides the
 *    auto-seed.
 * 3. Blocking before the scene is committed refuses at `$slate.scene`.
 * 4. A mixed call (script without staged, or staged without script) is refused at
 *    `$input` — the ambiguity is never guessed.
 * 5. Without a project, the resident form throws the actionable openProject
 *    prompt.
 */
export const test_mcp_block_resident = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-blockres-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });

    // 3a. a fresh project refuses at BOTH missing slices, in one round.
    const bare = app.block({ blocking: makeBlockingWrite() }).blocked;
    TestValidator.predicate(
      "a fresh project refuses at the slate script and scene together",
      bare.success === false &&
        hasViolation(bare, "type", "$slate.script") &&
        hasViolation(bare, "type", "$slate.scene"),
    );

    app.commitScript({
      script: {
        logline: scriptWrite.logline,
        theme: scriptWrite.theme,
        cast: scriptWrite.cast,
        beats: scriptWrite.beats,
      },
    });

    // 3. scene not committed yet → $slate.scene refusal.
    const early = app.block({ blocking: makeBlockingWrite() }).blocked;
    TestValidator.predicate(
      "a resident block before commitScene refuses at the slate scene",
      early.success === false && hasViolation(early, "type", "$slate.scene"),
    );

    const staged = app.stage({
      script: scriptWrite,
      staging: makeStagingWrite(),
    }).staged;
    if (staged.success !== true)
      throw new Error("staging fixture must succeed");
    app.commitScene({
      scene: staged.scene,
      models: [...new Set(staged.scene.nodes.map((node) => node.model))].map(
        (id) => ({ id, skeleton: null }),
      ),
    });

    // 1. bare resident block; beat-1 has no predecessor.
    const first = app.block({ blocking: makeBlockingWrite() }).blocked;
    TestValidator.predicate(
      "a resident block succeeds with previous null on the first beat",
      first.success === true && first.previous === null,
    );

    // 2. beat-1's committed end-state auto-seeds beat-2's block. The ladder
    // wants beat-1's shot first; a motion-less shot satisfies it without the
    // whole perform flow.
    const shotCommit = app.commitShot({
      shot: {
        id: "shot:beat-1",
        name: null,
        scene: staged.scene.id,
        camera: staged.scene.cameras[0]!.id,
        cameraMotion: null,
        performances: [],
        objectMotions: [],
        duration: 2,
      },
    });
    if (shotCommit.committed !== true)
      throw new Error("shot fixture must commit");
    const committed = beatEnd("beat-1");
    const endCommit = app.commitBeatEnd({ beatEnd: committed });
    if (endCommit.committed !== true)
      throw new Error(
        `beatEnd fixture must commit: ${JSON.stringify(endCommit)}`,
      );
    const seeded = app.block({
      blocking: {
        ...makeBlockingWrite(),
        beat: "beat-2",
        camera: { ...makeBlockingWrite().camera },
      },
    }).blocked;
    if (seeded.success !== true)
      throw new Error(`seeded block failed: ${JSON.stringify(seeded)}`);
    TestValidator.predicate(
      "a resident beat-2 block auto-seeds previous from the committed beat-1 end",
      seeded.previous !== null && seeded.previous.beat === "beat-1",
    );
    const overridden = app.block({
      blocking: { ...makeBlockingWrite(), beat: "beat-2" },
      previous: { ...committed, shot: "shot:override" },
    }).blocked;
    TestValidator.predicate(
      "an explicit previous overrides the auto-seed",
      overridden.success === true &&
        overridden.previous !== null &&
        overridden.previous.shot === "shot:override",
    );

    // 4. mixed calls are refused, never guessed.
    const mixedScript = app.block({
      script: scriptWrite,
      blocking: makeBlockingWrite(),
    }).blocked;
    const mixedStaged = app.block({
      staged,
      blocking: makeBlockingWrite(),
    }).blocked;
    TestValidator.predicate(
      "script without staged is refused",
      mixedScript.success === false &&
        hasViolation(mixedScript, "type", "$input"),
    );
    TestValidator.predicate(
      "staged without script is refused",
      mixedStaged.success === false &&
        hasViolation(mixedStaged, "type", "$input"),
    );
    const badStaged = app.block({
      script: scriptWrite,
      staged: 5 as never,
      blocking: makeBlockingWrite(),
    }).blocked;
    TestValidator.predicate(
      "a non-object explicit staged is a shape violation",
      badStaged.success === false &&
        hasViolation(badStaged, "type", "$input.staged"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  // 5. resident form without a project throws the actionable prompt.
  TestValidator.predicate(
    "a resident block without a project throws the openProject prompt",
    throwsError(
      () => new AutoMovieApplication().block({ blocking: makeBlockingWrite() }),
      ["openProject"],
    ),
  );
};
