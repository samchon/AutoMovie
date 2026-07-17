import { IAutoMovieGait, IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpActorSpec,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const scriptWrite = makeScriptWrite();

const walk: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const perf = () =>
  makePerformanceWrite({
    draft: [
      {
        verb: "locomote",
        actor: ["knightA", "knightB"],
        start: 0,
        duration: 2,
        gait: "walk",
        to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
      },
    ],
  });

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

/** Write one stored actor spec straight to `actors/<node>.json`. */
const writeActorFile = (root: string, spec: IAutoMovieMcpActorSpec): void =>
  fs.writeFileSync(
    path.join(root, "actors", `${spec.node}.json`),
    `${JSON.stringify(spec, null, 2)}\n`,
    "utf8",
  );

/**
 * A reopened project resolves cast rest poses from the persisted actor rigs
 * (#1229). Cast model skeletons used to live only in session memory (resident
 * `commitScene`'s `models`), so a second application session on a fully
 * committed project could not resolve even a rest pose — and the only in-band
 * recovery, re-running `commitScene`, wipes the committed shots. #1176 already
 * persists each performed actor's rig as `actors/<node>.json`; the resident
 * geometry context now merges those rigs (keyed by their scene node's model)
 * into the model set, so a fresh session resolves without a destructive
 * re-commit.
 *
 * Scenarios:
 *
 * 1. Session A commits the scene and performs (writing `actors/<node>.json`),
 *    never committing a shot. A FRESH application session on the same project
 *    root — with no session geometry memory at all — resolves the cast actor's
 *    rest pose for the beat, proving the skeleton came off disk. The merge is
 *    robust to a stored actor with no rig (skipped) and a stored actor whose
 *    scene node is gone (skipped), so neither derails resolving the real ones.
 * 2. After the cast actor's own persisted rig is removed, the fresh session throws
 *    the actionable "cannot resolve resident model" guidance — the merge fills
 *    real persisted rigs, it does not fabricate a missing one.
 */
export const test_mcp_geometry_reopened_actor = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-georeopen-"));
  try {
    // ── Session A: commit the scene and perform, writing actors/<node>.json.
    const sessionA = new AutoMovieApplication();
    sessionA.openProject({ root });
    sessionA.commitScript({
      script: {
        logline: scriptWrite.logline,
        theme: scriptWrite.theme,
        cast: scriptWrite.cast,
        beats: scriptWrite.beats,
      },
    });
    const staged = sessionA.stage({
      script: scriptWrite,
      staging: makeStagingWrite(),
    }).staged;
    if (staged.success !== true)
      throw new Error("staging fixture must succeed");
    // commitScene models carry NO skeleton — the only skeleton source for the
    // reopened session must be the persisted actor rigs, not this session's
    // memory (which the fresh session never sees anyway).
    sessionA.commitScene({
      scene: staged.scene,
      models: [...new Set(staged.scene.nodes.map((node) => node.model))].map(
        (id) => ({ id, skeleton: null }),
      ),
    });
    const positionOf = (id: string): IAutoMovieVector3 => {
      const node = staged.scene.nodes.find((entry) => entry.id === id);
      if (node === undefined) throw new Error(`missing node ${id}`);
      return node.transform.translation;
    };
    const performed = sessionA.perform({
      performance: perf(),
      actors: {
        knightA: actorContext(positionOf("knightA"), 0),
        knightB: actorContext(positionOf("knightB"), 180),
      },
    }).performed;
    if (performed.success !== true)
      throw new Error(
        `session A perform must succeed: ${JSON.stringify(performed)}`,
      );
    TestValidator.predicate(
      "session A persisted the actor rigs to disk",
      fs.existsSync(path.join(root, "actors", "knightA.json")),
    );

    // Two persisted actors the merge must skip without derailing: one with no
    // rig (nothing to contribute), one whose scene node no longer exists.
    const base = actorContext({ x: 0, y: 0, z: 0 }, 0);
    writeActorFile(root, {
      node: "riglessActor",
      skeleton: base.skeleton,
      gaits: base.gaits,
      speed: base.speed,
      eyeHeight: base.eyeHeight,
      restPose: base.restPose,
    });
    writeActorFile(root, {
      node: "ghostActor", // not a node in the committed scene
      skeleton: base.skeleton,
      gaits: base.gaits,
      speed: base.speed,
      eyeHeight: base.eyeHeight,
      restPose: base.restPose,
      rig: createSkeleton(),
    });

    // ── Session B: a fresh application with no geometry memory whatsoever.
    const sessionB = new AutoMovieApplication();
    sessionB.openProject({ root });

    // 1. the reopened session resolves the cast rest pose from the persisted rig
    const resolved = sessionB.getResolvedPose({
      actor: "knightA",
      beat: scriptWrite.beats[0]!.id,
    }).resolvedPose;
    TestValidator.predicate(
      "a reopened project resolves the cast rest pose from actors/<node>.json",
      resolved !== null &&
        resolved.motion === null &&
        resolved.bones.length > 0,
    );

    // 2. once the cast actor's own persisted rig is gone, resolving throws
    fs.rmSync(path.join(root, "actors", "knightA.json"));
    const sessionC = new AutoMovieApplication();
    sessionC.openProject({ root });
    TestValidator.predicate(
      "a cast node without a persisted rig still throws the model guidance",
      throwsError(
        () =>
          sessionC.getResolvedPose({
            actor: "knightA",
            beat: scriptWrite.beats[0]!.id,
          }),
        ["cannot resolve resident model"],
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
