import { IAutoMovieGait, IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpWritableSlate,
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

const scriptWrite = makeScriptWrite();
const script = {
  logline: scriptWrite.logline,
  theme: scriptWrite.theme,
  cast: scriptWrite.cast,
  beats: scriptWrite.beats,
};

/**
 * Motions are a re-perform-derived output, not a persisted slice: a shot stores
 * motion id references, and the clips live only in what a `perform` returned.
 * So a RESIDENT commitShot referencing motions must carry the `motions`
 * registry those references resolve against; else it would persist a dangling
 * id, unresolvable when the project is re-opened and the motion is re-derived.
 * An explicit-slate commitShot stays a pure transform (its cross-slice
 * references are the caller's to guarantee), byte-compatible with before.
 *
 * Scenarios:
 *
 * 1. A performed shot carries a non-null motion reference (the registry-check has
 *    something to bite on).
 * 2. Resident commitShot with the shot but NO `motions` → refused, with a
 *    `$input.motions` violation naming the missing registry; no `shots/` file
 *    is written.
 * 3. Resident commitShot with the matching `motions` registry → committed, the
 *    file appears.
 * 4. Resident commitShot with an EMPTY registry (the reference is dangling) →
 *    refused, with a `$input.shot.performances[].motion` violation.
 * 5. Explicit-slate commitShot with NO `motions` → still committed (pure
 *    transform, unchanged from before this gate).
 */
export const test_mcp_commit_shot_motion_registry = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-motionref-"));
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
    const blocked = app.block({
      script: scriptWrite,
      staged,
      blocking: makeBlockingWrite({ duration: 1 }),
    }).blocked;
    if (blocked.success !== true) throw new Error("block fixture must succeed");
    const performed = app.perform({
      script: scriptWrite,
      staged,
      performance: makePerformanceWrite({
        duration: 1,
        draft: [
          {
            verb: "locomote",
            actor: ["knightA", "knightB"],
            start: 0,
            duration: 1,
            gait: "walk",
            to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
          },
        ],
      }),
      actors: {
        knightA: actorContext(position("knightA"), 0),
        knightB: actorContext(position("knightB"), 180),
      },
      blocking: blocked.blocking,
    }).performed;
    if (performed.success !== true)
      throw new Error("perform fixture must succeed");

    // 1. the performed shot references a compiled motion.
    TestValidator.predicate(
      "performed shot carries a motion reference",
      performed.shot.performances.some(
        (performance) => performance.motion !== null,
      ),
    );

    const shotFile = path.join(
      root,
      "shots",
      `${performed.shot.id.slice("shot:".length)}.json`,
    );

    // 2. resident, no registry → refused, nothing written.
    const noRegistry = app.commitShot({ shot: performed.shot });
    TestValidator.equals(
      "resident commitShot without motions is refused",
      noRegistry.committed,
      false,
    );
    TestValidator.predicate(
      "refusal names the missing motions registry",
      noRegistry.validation.success === false &&
        noRegistry.validation.violations.some(
          (violation) => violation.path === "$input.motions",
        ),
    );
    TestValidator.equals(
      "refused resident commit writes no shot file",
      fs.existsSync(shotFile),
      false,
    );

    // 3. resident, matching registry → committed, file appears.
    const withRegistry = app.commitShot({
      shot: performed.shot,
      motions: performed.motions,
    });
    TestValidator.equals(
      "resident commitShot with motions is committed",
      withRegistry.committed,
      true,
    );
    TestValidator.equals(
      "committed resident shot is persisted",
      fs.existsSync(shotFile),
      true,
    );

    // 4. resident, empty registry → the reference is dangling, refused.
    const emptyRegistry = app.commitShot({
      shot: performed.shot,
      motions: {},
    });
    TestValidator.equals(
      "resident commitShot with an empty registry is refused",
      emptyRegistry.committed,
      false,
    );
    TestValidator.predicate(
      "refusal names the dangling performance motion",
      emptyRegistry.validation.success === false &&
        emptyRegistry.validation.violations.some((violation) =>
          violation.path.endsWith(".motion"),
        ),
    );

    // 5. explicit-slate, no registry → still a pure transform, committed.
    const explicitSlate: IAutoMovieMcpWritableSlate = {
      script,
      scene: staged.scene,
      shots: [],
      beatEnds: [],
      notes: [],
      film: null,
    };
    const explicit = app.commitShot({
      slate: explicitSlate,
      shot: performed.shot,
    });
    TestValidator.equals(
      "explicit-slate commitShot without motions stays committed (byte-compatible)",
      explicit.committed,
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
