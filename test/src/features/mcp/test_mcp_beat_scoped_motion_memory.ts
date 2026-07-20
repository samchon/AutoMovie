import { IAutoMovieGait, IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";

const walk: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const actorContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const skeleton = createSkeleton();
  return {
    skeleton: skeleton.id,
    gaits: [walk],
    position,
    speed: 1,
    facingDeg,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig: skeleton,
  };
};

/**
 * Resident motion memory is BEAT-scoped (#1091): `compilePerformance` names
 * every actor's compiled clip `perform:<actor>`, not beat-scoped, so a shared
 * session registry let beat 2's `commitShot` silently overwrite beat 1's clip
 * for the same actor. `getShotEndState` for the earlier beat then sampled the
 * WRONG beat's clip with `reason: null` and plausible numbers, corrupting the
 * continuity ladder for the most common case (the same protagonist performing
 * in consecutive beats).
 *
 * Scenario: a two-beat duel where both beats walk the same actors to DIFFERENT
 * destinations over DIFFERENT durations. Beat 1's end state is captured right
 * after its commit; committing beat 2 (colliding clip ids) must leave beat 1's
 * derived end state byte-identical, and beat 2's own end state must resolve
 * through its own registry.
 */
export const test_mcp_beat_scoped_motion_memory = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-beatmem-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
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
          name: "the retreat",
          summary: "both fall back",
          durationHint: 3,
        },
      ],
    });
    app.commitScript({
      script: {
        logline: scriptWrite.logline,
        theme: scriptWrite.theme,
        cast: scriptWrite.cast,
        beats: scriptWrite.beats,
      },
    });

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
    const position = (id: string): IAutoMovieVector3 => {
      const node = staged.scene.nodes.find((entry) => entry.id === id);
      if (node === undefined) throw new Error(`missing node ${id}`);
      return node.transform.translation;
    };
    const actors = () => ({
      knightA: actorContext(position("knightA"), 0),
      knightB: actorContext(position("knightB"), 180),
    });

    const commitBeat = (
      beat: string,
      duration: number,
      destination: number,
    ): void => {
      const blocked = app.block({
        script: scriptWrite,
        staged,
        blocking: makeBlockingWrite({ beat, duration }),
      }).blocked;
      if (blocked.success !== true)
        throw new Error(`block fixture must succeed for ${beat}`);
      const performed = app.perform({
        script: scriptWrite,
        staged,
        performance: makePerformanceWrite({
          beat,
          duration,
          draft: [
            {
              verb: "locomote",
              actor: ["knightA", "knightB"],
              start: 0,
              duration,
              gait: "walk",
              to: { kind: "point", point: { x: 0, y: 0, z: destination } },
            },
          ],
        }),
        actors: actors(),
        blocking: blocked.blocking,
      }).performed;
      if (performed.success !== true)
        throw new Error(`perform fixture must succeed for ${beat}`);
      const committed = app.commitShot({
        shot: performed.shot,
        motions: performed.motions,
      });
      if (committed.committed !== true)
        throw new Error(`commitShot must succeed for ${beat}`);
    };

    commitBeat("beat-1", 1, 0.35);
    const before = app.getShotEndState({ beat: "beat-1" });
    TestValidator.predicate(
      "beat 1's end state derives right after its commit",
      before.beatEnd !== null && before.reason === null,
    );

    // beat 2 commits clips under the SAME `perform:<actor>` ids
    commitBeat("beat-2", 2, 0.7);

    TestValidator.equals(
      "beat 1's end state is untouched by beat 2's colliding clip ids",
      app.getShotEndState({ beat: "beat-1" }),
      before,
    );
    const second = app.getShotEndState({ beat: "beat-2" });
    TestValidator.predicate(
      "beat 2's end state resolves through its own registry",
      second.beatEnd !== null && second.reason === null,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
