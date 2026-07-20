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

/**
 * BOTH cast members reference one `modelRef`: the shared-model case (#1244). A
 * rig is per-actor while a model id is shared, so this is the arrangement a
 * model-keyed rig merge silently collapses.
 */
const scriptWrite = makeScriptWrite({
  cast: [
    { node: "knightA", character: "the challenger", modelRef: "stickman" },
    { node: "knightB", character: "the champion", modelRef: "stickman" },
  ],
});

const walk: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

/** A rig told apart from its sibling by the hips rest height. */
const rigWithHipsY = (y: number) => {
  const base = createSkeleton();
  return {
    ...base,
    bones: base.bones.map((bone) =>
      bone.bone === "hips"
        ? {
            ...bone,
            rest: {
              ...bone.rest,
              translation: { ...bone.rest.translation, y },
            },
          }
        : bone,
    ),
  };
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
  rig: ReturnType<typeof rigWithHipsY> = createSkeleton(),
): IAutoMovieMcpActorContext => ({
  skeleton: rig.id,
  gaits: [walk],
  position,
  speed: 1,
  facingDeg,
  eyeHeight: 1.6,
  restPose: makePose([]),
  rig,
});

/** The resolved hips height: the value that tells the two rigs apart. */
const hipsYOf = (app: AutoMovieApplication, actor: string): number | null =>
  app
    .getResolvedPose({ actor, beat: scriptWrite.beats[0]!.id })
    .resolvedPose?.bones.find((b) => b.bone === "hips")?.worldPosition.y ??
  null;

/** Write one stored actor spec straight to `actors/<node>.json`. */
const writeActorFile = (root: string, spec: IAutoMovieMcpActorSpec): void =>
  fs.writeFileSync(
    path.join(root, "actors", `${spec.node}.json`),
    `${JSON.stringify(spec, null, 2)}\n`,
    "utf8",
  );

/**
 * A reopened project resolves cast rest poses from the persisted actor rigs
 * (#1229), and each actor resolves its OWN rig (#1244). Cast model skeletons
 * used to live only in session memory (resident `commitScene`'s `models`), so a
 * second application session on a fully committed project could not resolve
 * even a rest pose, and the only in-band recovery, re-running `commitScene`,
 * wipes the committed shots. #1176 persists each performed actor's rig as
 * `actors/<node>.json`; the resident geometry context reads those rigs keyed by
 * their own node.
 *
 * The rig is per-ACTOR while a model id is shared, so the rigs must never be
 * re-keyed into the model namespace: this fixture puts BOTH cast members on one
 * `modelRef` with provably different rigs, the arrangement a model-keyed merge
 * collapses to a single arbitrary rig (#1244).
 *
 * Scenarios:
 *
 * 1. Session A commits the scene and performs (writing `actors/<node>.json`),
 *    never committing a shot. A FRESH session on the same root (no session
 *    geometry memory at all) resolves EACH actor's own rig off disk, though
 *    both share one model id. Robust to a stored actor with no rig and one
 *    whose scene node is gone (both skipped without derailing the real ones).
 * 2. A `commitScene` model carrying `skeleton: null` is the ABSENCE of a rig, not
 *    a rig: it must not mask the actor's own persisted one, so the session that
 *    just wrote the rigs resolves them too (it used to resolve worse than a
 *    reopened project).
 * 3. A session `commitScene` model carrying a REAL skeleton still overrides the
 *    persisted rig for that model: session memory stays authoritative when it
 *    actually carries a rig.
 * 4. An actor with no rig anywhere throws the actionable guidance, which names the
 *    rig-persisting path (`perform`) rather than only the destructive
 *    `commitScene`.
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
    // commitScene models carry NO skeleton: the only skeleton source for the
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
    // Provably DIFFERENT rigs on the two nodes that share model "stickman".
    const performed = sessionA.perform({
      performance: perf(),
      actors: {
        knightA: actorContext(positionOf("knightA"), 0, rigWithHipsY(1)),
        knightB: actorContext(positionOf("knightB"), 180, rigWithHipsY(5)),
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
    TestValidator.equals(
      "both cast nodes share one model id (the collision arrangement)",
      [
        ...new Set(
          staged.scene.nodes
            .filter((n) => n.id === "knightA" || n.id === "knightB")
            .map((n) => n.model),
        ),
      ],
      ["stickman"],
    );

    // 2. a skeleton:null session model must not mask the persisted rig. The
    // session that just wrote the rigs resolves them in-session.
    TestValidator.equals(
      "a skeleton:null session model does not mask the persisted rig",
      hipsYOf(sessionA, "knightA"),
      1,
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

    // 1b. and EACH actor resolves its OWN rig, though both share model
    // "stickman": a model-keyed merge gave both the last-read rig (#1244).
    TestValidator.equals(
      "each actor on a shared model resolves its own persisted rig",
      [hipsYOf(sessionB, "knightA"), hipsYOf(sessionB, "knightB")],
      [1, 5],
    );

    // 3. a session model carrying a REAL skeleton still overrides the persisted
    // rig for that model: session memory is authoritative when it has a rig.
    const sessionOverride = new AutoMovieApplication();
    sessionOverride.openProject({ root });
    sessionOverride.commitScene({
      scene: staged.scene,
      models: [...new Set(staged.scene.nodes.map((node) => node.model))].map(
        (id) => ({ id, skeleton: rigWithHipsY(9) }),
      ),
    });
    TestValidator.equals(
      "a session model with a real skeleton overrides the persisted rig",
      hipsYOf(sessionOverride, "knightA"),
      9,
    );

    // 4. an actor with no rig anywhere throws guidance naming the rig-persisting
    // path (`perform`), not only the destructive commitScene the fix removed.
    fs.rmSync(path.join(root, "actors", "knightA.json"));
    const sessionC = new AutoMovieApplication();
    sessionC.openProject({ root });
    TestValidator.predicate(
      "an actor with no rig anywhere throws guidance naming perform",
      throwsError(
        () =>
          sessionC.getResolvedPose({
            actor: "knightA",
            beat: scriptWrite.beats[0]!.id,
          }),
        ["cannot resolve a rig for actor", "resident perform"],
      ),
    );
    TestValidator.equals(
      "the sibling actor's own rig still resolves after the erase",
      hipsYOf(sessionC, "knightB"),
      5,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
