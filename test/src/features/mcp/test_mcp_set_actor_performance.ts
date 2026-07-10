import {
  IAutoMovieReviewNote,
  IAutoMovieScript,
  IAutoMovieShot,
  IAutoMovieShotPerformance,
} from "@automovie/interface";
import { AutoMovieApplication, IAutoMovieMcpMotion } from "@automovie/mcp";
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
  performances: [
    { node: "knightA", motion: `charge-a-${beat}`, startOffset: 0 },
    { node: "knightB", motion: `brace-b-${beat}`, startOffset: 0.25 },
  ],
  objectMotions: [],
  duration: 1,
});

/**
 * The motions a beat's shot references — the registry a resident commitShot
 * needs so its motion ids are not dangling (#696).
 */
const motionsFor = (beat: string) => ({
  a: {
    id: `charge-a-${beat}`,
    skeleton: "stickman",
    duration: 1,
    loop: false,
    keyframes: [],
  },
  b: {
    id: `brace-b-${beat}`,
    skeleton: "stickman",
    duration: 1,
    loop: false,
    keyframes: [],
  },
});

/**
 * SetActorPerformance (#654): the AutoBe one-artifact-per-call granularity
 * below the beat — replace ONE actor's performance in a committed shot without
 * re-performing the whole beat. Replacement-only, evidence-backed,
 * resident-only.
 *
 * Scenarios:
 *
 * 1. Replacing knightB's performance in beat-1 swaps exactly that entry: knightA's
 *    entry is deep-equal to before, beat-2's shot file stays byte-identical on
 *    disk, beat-1's shot file reflects the new motion (write-through), beat-1's
 *    beat-end and notes are removed (stale without the performance they
 *    sampled) while beat-2's survive, and the film is cleared.
 * 2. The motions registry gates the reference with commitShot's RESIDENT semantics
 *    (#1095): a matching registry accepts; a registry without the named motion
 *    violates at `$input.performance.motion`; a motion reference with NO
 *    registry violates at `$input.motions` (persisting it would store a
 *    dangling id) while a `motion: null` splice needs none; and malformed
 *    performance/registry shapes return validation instead of raw TypeErrors.
 * 3. A beat with no committed shot violates at `$input.beat` — a set names a thing
 *    that exists.
 * 4. A node that does not perform in the shot violates at
 *    `$input.performance.node` — a NEW performer is perform + commitShot's job
 *    (replacement-only).
 * 5. An empty reason violates (evidence discipline); a startOffset beyond the
 *    shot's duration violates; nothing is written in any refused case.
 * 6. Without an active project the tool throws the actionable openProject guidance
 *    (set is resident-only).
 */
export const test_mcp_set_actor_performance = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-setperf-"));
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
    app.commitShot({
      shot: makeShot("beat-1", staged.scene.id),
      motions: motionsFor("beat-1"),
    });
    app.commitShot({
      shot: makeShot("beat-2", staged.scene.id),
      motions: motionsFor("beat-2"),
    });
    app.commitBeatEnd({
      beatEnd: { beat: "beat-1", shot: "shot:beat-1", actors: [] },
    });
    app.commitBeatEnd({
      beatEnd: { beat: "beat-2", shot: "shot:beat-2", actors: [] },
    });
    const notes: IAutoMovieReviewNote[] = [
      {
        beat: "beat-1",
        tier: "physical",
        issue: "brace no longer matches the parry timing",
        suggestion: "review after the replacement performance lands",
      },
      {
        beat: "beat-2",
        tier: "visual",
        issue: "camera clips the shield rim",
        suggestion: "hold the tighter frame",
      },
    ];
    app.commitNotes({ notes });

    const shot2File = path.join(root, "shots", "beat-2.json");
    const notesFile = path.join(root, "notes.json");
    const shot2Before = fs.readFileSync(shot2File, "utf8");
    const knightABefore = app
      .getShot({ beat: "beat-1" })
      .shot?.performances.find((entry) => entry.node === "knightA");

    const malformedRequest = app.setActorPerformance(null as never);
    TestValidator.equals(
      "malformed request root refused",
      malformedRequest.updated,
      false,
    );
    TestValidator.predicate(
      "malformed request root located",
      hasViolation(malformedRequest.validation, "type", "$input"),
    );
    TestValidator.equals(
      "malformed request keeps both shots",
      malformedRequest.slate.shots.map((entry) => entry.id),
      ["shot:beat-1", "shot:beat-2"],
    );

    // 1. The surgical replacement.
    const updated = app.setActorPerformance({
      beat: "beat-1",
      performance: { node: "knightB", motion: "parry-b", startOffset: 0.5 },
      motions: {
        b: {
          id: "parry-b",
          skeleton: "stickman",
          duration: 1,
          loop: false,
          keyframes: [],
        },
      },
      reason: "the champion should parry, not brace",
    });
    TestValidator.equals("set applies", updated.updated, true);
    const after = app.getShot({ beat: "beat-1" }).shot!;
    TestValidator.equals(
      "knightB's performance swapped",
      after.performances.find((entry) => entry.node === "knightB"),
      { node: "knightB", motion: "parry-b", startOffset: 0.5 },
    );
    TestValidator.equals(
      "knightA's performance untouched",
      after.performances.find((entry) => entry.node === "knightA"),
      knightABefore,
    );
    TestValidator.equals(
      "beat-2's shot file byte-identical",
      fs.readFileSync(shot2File, "utf8"),
      shot2Before,
    );
    TestValidator.equals(
      "beat-1's shot file reflects the new motion (write-through)",
      fs
        .readFileSync(path.join(root, "shots", "beat-1.json"), "utf8")
        .includes('"parry-b"'),
      true,
    );
    TestValidator.equals(
      "beat-1's beat-end removed (stale)",
      fs.existsSync(path.join(root, "beatEnds", "beat-1.json")),
      false,
    );
    TestValidator.equals(
      "beat-2's beat-end survives",
      fs.existsSync(path.join(root, "beatEnds", "beat-2.json")),
      true,
    );
    TestValidator.equals(
      "beat-1's notes removed (stale)",
      app.getNotes({ beat: "beat-1" }).notes,
      [],
    );
    TestValidator.equals(
      "beat-2's notes survive",
      app.getNotes({ beat: "beat-2" }).notes,
      [notes[1]],
    );
    TestValidator.equals(
      "notes file keeps only sibling beat notes",
      JSON.parse(fs.readFileSync(notesFile, "utf8")),
      [notes[1]],
    );
    TestValidator.equals("film cleared", updated.slate.film, null);

    // 2. The motions registry gates the reference.
    const parry = {
      id: "parry-b2",
      skeleton: "stickman",
      duration: 1,
      loop: false,
      keyframes: [],
    };
    const withRegistry = app.setActorPerformance({
      beat: "beat-1",
      performance: { node: "knightB", motion: "parry-b2", startOffset: 0 },
      motions: { knightB: parry },
      reason: "retimed parry from a fresh perform",
    });
    TestValidator.equals(
      "matching registry accepts",
      withRegistry.updated,
      true,
    );
    const mismatch = app.setActorPerformance({
      beat: "beat-1",
      performance: { node: "knightB", motion: "ghost-motion", startOffset: 0 },
      motions: { knightB: parry },
      reason: "reference a motion the registry does not carry",
    });
    TestValidator.equals(
      "mismatched registry refuses",
      mismatch.updated,
      false,
    );
    TestValidator.predicate(
      "mismatch located at the motion",
      hasViolation(mismatch.validation, "type", "$input.performance.motion"),
    );
    // #1095: a motion reference with NO registry would persist a dangling id
    // (motions are re-perform-derived, not stored) — refused at the registry.
    const shot1File = path.join(root, "shots", "beat-1.json");
    const shot1Before = fs.readFileSync(shot1File, "utf8");
    const registryless = app.setActorPerformance({
      beat: "beat-1",
      performance: {
        node: "knightB",
        motion: "ghost:never-compiled",
        startOffset: 0,
      },
      reason: "splice a motion id with no registry to resolve it",
    });
    TestValidator.equals(
      "a registry-less motion reference refuses",
      registryless.updated,
      false,
    );
    TestValidator.predicate(
      "the registry-less refusal is located at the registry",
      hasViolation(registryless.validation, "type", "$input.motions"),
    );
    TestValidator.equals(
      "the refused splice writes nothing",
      fs.readFileSync(shot1File, "utf8"),
      shot1Before,
    );
    // negative twin: clearing the motion needs no registry — there is no id
    // left to dangle.
    const cleared = app.setActorPerformance({
      beat: "beat-1",
      performance: { node: "knightB", motion: null, startOffset: 0 },
      reason: "the champion holds still this beat",
    });
    TestValidator.equals(
      "a null-motion splice needs no registry",
      cleared.updated,
      true,
    );
    const malformedPerformance = app.setActorPerformance({
      beat: "beat-1",
      performance: null as unknown as IAutoMovieShotPerformance,
      reason: "reject a malformed performance payload",
    });
    TestValidator.equals(
      "malformed performance refuses",
      malformedPerformance.updated,
      false,
    );
    TestValidator.predicate(
      "malformed performance located",
      hasViolation(
        malformedPerformance.validation,
        "type",
        "$input.performance",
      ),
    );
    const malformedRegistry = app.setActorPerformance({
      beat: "beat-1",
      performance: { node: "knightB", motion: "ghost-motion", startOffset: 0 },
      motions: null as unknown as Record<string, IAutoMovieMcpMotion>,
      reason: "reject a malformed registry",
    });
    TestValidator.equals(
      "malformed motion registry refuses",
      malformedRegistry.updated,
      false,
    );
    TestValidator.predicate(
      "malformed registry located",
      hasViolation(malformedRegistry.validation, "type", "$input.motions"),
    );
    const malformedRegistryEntry = app.setActorPerformance({
      beat: "beat-1",
      performance: { node: "knightB", motion: "ghost-motion", startOffset: 0 },
      motions: {
        "ghost-motion": undefined,
      } as unknown as Record<string, IAutoMovieMcpMotion>,
      reason: "reject a malformed registry entry",
    });
    TestValidator.equals(
      "malformed motion registry entry refuses",
      malformedRegistryEntry.updated,
      false,
    );
    TestValidator.predicate(
      "malformed registry entry located",
      hasViolation(
        malformedRegistryEntry.validation,
        "type",
        "$input.motions.ghost-motion",
      ),
    );

    // 3. A ghost beat.
    const ghostBeat = app.setActorPerformance({
      beat: "beat-9",
      performance: { node: "knightB", motion: "parry-b", startOffset: 0 },
      reason: "edit a beat that was never shot",
    });
    TestValidator.equals("ghost beat refuses", ghostBeat.updated, false);
    TestValidator.predicate(
      "ghost beat located",
      hasViolation(ghostBeat.validation, "type", "$input.beat"),
    );

    // 4. Replacement-only: a new performer is refused.
    const newActor = app.setActorPerformance({
      beat: "beat-1",
      performance: { node: "knightC", motion: "ambush-c", startOffset: 0 },
      reason: "sneak a third knight into the duel",
    });
    TestValidator.equals("new performer refuses", newActor.updated, false);
    TestValidator.predicate(
      "new performer located at the node",
      hasViolation(newActor.validation, "type", "$input.performance.node"),
    );

    // 5. Evidence + range twins.
    const noReason = app.setActorPerformance({
      beat: "beat-1",
      performance: { node: "knightB", motion: "parry-b", startOffset: 0 },
      reason: "   ",
    });
    TestValidator.equals("empty reason refuses", noReason.updated, false);
    TestValidator.predicate(
      "reason located",
      hasViolation(noReason.validation, "type", "$input.reason"),
    );
    const late = app.setActorPerformance({
      beat: "beat-1",
      performance: { node: "knightB", motion: "parry-b", startOffset: 9 },
      reason: "start after the shot already ended",
    });
    TestValidator.equals("late startOffset refuses", late.updated, false);
    TestValidator.predicate(
      "startOffset located",
      hasViolation(late.validation, "range", "$input.performance.startOffset"),
    );

    // 6. Resident-only.
    TestValidator.predicate(
      "no project throws the openProject guidance",
      throwsError(
        () =>
          new AutoMovieApplication().setActorPerformance({
            beat: "beat-1",
            performance: {
              node: "knightB",
              motion: "parry-b",
              startOffset: 0,
            },
            reason: "no project is active",
          }),
        "openProject",
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
