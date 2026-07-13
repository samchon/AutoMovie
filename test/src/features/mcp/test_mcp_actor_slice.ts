import {
  IAutoMovieBeatEndActorState,
  IAutoMovieBeatEndState,
  IAutoMovieGait,
} from "@automovie/interface";
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
import {
  IDENTITY_TRANSFORM,
  createSkeleton,
  makePose,
} from "../internal/fixtures";
import { hasViolation, throwsError } from "../internal/predicates";

const scriptWrite = makeScriptWrite({
  beats: [
    { id: "beat-1", name: "one", summary: "the charge", durationHint: 2 },
    { id: "beat-2", name: "two", summary: "the aftermath", durationHint: 2 },
  ],
});

const walk: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

/** A solvable performance: one walk the named knights share. */
const perf = (
  beat: string,
  actor: string | string[] = ["knightA", "knightB"],
) =>
  makePerformanceWrite({
    beat,
    draft: [
      {
        verb: "locomote",
        actor,
        start: 0,
        duration: 2,
        gait: "walk",
        to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
      },
    ],
  });

const ENDINGS = {
  knightA: { position: { x: 0.25, y: 0, z: 0.05 }, facingDeg: 90 },
  knightB: { position: { x: -0.25, y: 0, z: 0.1 }, facingDeg: 0 },
} as const;

const endActor = (node: keyof typeof ENDINGS): IAutoMovieBeatEndActorState => {
  const ending = ENDINGS[node];
  const radians = (ending.facingDeg * Math.PI) / 180;
  return {
    node,
    transform: { ...IDENTITY_TRANSFORM, translation: ending.position },
    facing: { x: Math.sin(radians), y: 0, z: Math.cos(radians) },
    pose: null,
    motion: null,
    localTime: 2,
    gaitPhase: null,
    rootVelocity: null,
    footPlants: null,
    mount: null,
  };
};

/**
 * The actors slice (#1176): a successful resident `perform` with an explicit
 * registry writes each context's beat-invariant half through as
 * `actors/<node>.json`, so a later resident `perform` omits `actors` entirely —
 * the stored contexts come back with their openings continuity-seeded — and
 * `eraseActor` is the targeted removal mirror.
 *
 * Scenarios:
 *
 * 1. An omitted registry over an empty store refuses at `$slate.actors`; a failed
 *    perform stores nothing.
 * 2. A successful resident perform stores exactly the invariant half (rig and rest
 *    frames only when carried); the summary lists the nodes; a later
 *    single-actor perform upserts its own file and leaves the sibling
 *    byte-identical.
 * 3. An omitted registry compiles the same shot the explicit registry did.
 * 4. A node case-colliding with a stored sibling — or with another node of the
 *    same registry — is refused before anything runs (#1093).
 * 5. Store faults are blamed at the store: a tampered context reports
 *    `$slate.actors.<node>...`, an unseedable loaded opening likewise, and a
 *    node/filename mismatch throws the keyed-slice error.
 * 6. `eraseActor` refuses a staged actor, an absent context, malformed scalars,
 *    and a blank reason; after the scene is re-committed without the node, the
 *    erase removes exactly its file. Without a project it throws the
 *    openProject prompt.
 */
export const test_mcp_actor_slice = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-actors-"));
  try {
    const app = new AutoMovieApplication();
    app.openProject({ root });
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
    app.commitShot({
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
    app.commitBeatEnd({
      beatEnd: {
        beat: "beat-1",
        shot: "shot:beat-1",
        actors: [endActor("knightA"), endActor("knightB")],
      } satisfies IAutoMovieBeatEndState,
    });

    const rigged = createSkeleton();
    const knightA: IAutoMovieMcpActorContext = {
      skeleton: rigged.id,
      gaits: [walk],
      position: ENDINGS.knightA.position,
      speed: 1,
      facingDeg: ENDINGS.knightA.facingDeg,
      eyeHeight: 1.6,
      restPose: makePose([]),
      rig: rigged,
      restFrames: { rightUpperArm: { abduction: { sign: -1, neutral: 90 } } },
    };
    // knightB carries neither rig nor rest frames — the optional halves of the
    // stored spec stay absent, not null-filled.
    const knightB: IAutoMovieMcpActorContext = {
      skeleton: rigged.id,
      gaits: [walk],
      position: ENDINGS.knightB.position,
      speed: 1,
      facingDeg: ENDINGS.knightB.facingDeg,
      eyeHeight: 1.6,
      restPose: makePose([]),
    };
    const fileA = path.join(root, "actors", "knightA.json");
    const fileB = path.join(root, "actors", "knightB.json");

    // 1a. omitted registry over an empty store.
    const emptyStore = app.perform({ performance: perf("beat-2") }).performed;
    TestValidator.predicate(
      "an omitted registry over an empty store refuses at the slate",
      emptyStore.success === false &&
        hasViolation(emptyStore, "type", "$slate.actors"),
    );

    // 1b. a failed perform (a gait the contexts lack) stores nothing.
    const failed = app.perform({
      performance: makePerformanceWrite({
        beat: "beat-2",
        draft: [
          {
            verb: "locomote",
            actor: "knightA",
            start: 0,
            duration: 2,
            gait: "sprint",
            to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
          },
        ],
      }),
      actors: { knightA, knightB },
    }).performed;
    TestValidator.equals(
      "unknown gait fails the perform",
      failed.success,
      false,
    );
    TestValidator.equals(
      "a failed perform stores nothing",
      fs.existsSync(fileA),
      false,
    );

    // 2. the first successful resident perform stores the invariant halves.
    const first = app.perform({
      performance: perf("beat-2"),
      actors: { knightA, knightB },
    }).performed;
    if (first.success !== true)
      throw new Error(`first perform must succeed: ${JSON.stringify(first)}`);
    TestValidator.equals(
      "actors/knightA.json holds exactly the beat-invariant half",
      JSON.parse(fs.readFileSync(fileA, "utf8")) as IAutoMovieMcpActorSpec,
      {
        node: "knightA",
        skeleton: knightA.skeleton,
        gaits: knightA.gaits,
        speed: knightA.speed,
        eyeHeight: knightA.eyeHeight,
        restPose: knightA.restPose,
        rig: knightA.rig!,
        restFrames: knightA.restFrames,
      },
    );
    const storedB = JSON.parse(
      fs.readFileSync(fileB, "utf8"),
    ) as IAutoMovieMcpActorSpec;
    TestValidator.predicate(
      "an uncarried rig and rest frames stay absent in the stored spec",
      !("rig" in storedB) &&
        !("restFrames" in storedB) &&
        !("position" in storedB) &&
        !("facingDeg" in storedB),
    );
    TestValidator.equals(
      "the summary lists the stored actor nodes",
      app.nextSteps().status.actors,
      ["knightA", "knightB"],
    );

    // 3. an omitted registry compiles the same shot the explicit one did.
    const loaded = app.perform({ performance: perf("beat-2") }).performed;
    if (loaded.success !== true)
      throw new Error(`loaded perform must succeed: ${JSON.stringify(loaded)}`);
    TestValidator.equals(
      "the loaded registry compiles the explicit registry's shot",
      { shot: loaded.shot, motions: loaded.motions },
      { shot: first.shot, motions: first.motions },
    );

    // 2b. a single-actor re-perform upserts exactly its own file.
    const bytesB = fs.readFileSync(fileB, "utf8");
    const faster = app.perform({
      performance: perf("beat-2", "knightA"),
      actors: { knightA: { ...knightA, speed: 2 } },
    }).performed;
    if (faster.success !== true)
      throw new Error("single-actor re-perform must succeed");
    TestValidator.equals(
      "the re-perform upserted its own file",
      (JSON.parse(fs.readFileSync(fileA, "utf8")) as IAutoMovieMcpActorSpec)
        .speed,
      2,
    );
    TestValidator.equals(
      "the sibling actor's file stays byte-identical",
      fs.readFileSync(fileB, "utf8"),
      bytesB,
    );

    // 4. case collisions are refused before anything runs.
    const storedCollision = app.perform({
      performance: perf("beat-2"),
      actors: { knighta: knightA },
    }).performed;
    TestValidator.predicate(
      "a node colliding with a stored sibling is refused",
      storedCollision.success === false &&
        hasViolation(storedCollision, "type", "$input.actors.knighta"),
    );
    const speedA = (
      JSON.parse(fs.readFileSync(fileA, "utf8")) as IAutoMovieMcpActorSpec
    ).speed;
    TestValidator.equals(
      "the refused collision left the stored sibling alone",
      speedA,
      2,
    );
    const intraCollision = app.perform({
      performance: perf("beat-2"),
      actors: { Guard: knightA, guard: knightB },
    }).performed;
    TestValidator.predicate(
      "two registry nodes colliding with each other are refused",
      intraCollision.success === false &&
        hasViolation(intraCollision, "type", "$input.actors.guard"),
    );

    // 5a. a loaded opening nothing can seed is blamed at the store.
    const loadedFirstBeat = app.perform({
      performance: perf("beat-1"),
    }).performed;
    TestValidator.predicate(
      "a loaded registry on a seedless beat is blamed at the slate",
      loadedFirstBeat.success === false &&
        hasViolation(loadedFirstBeat, "type", "$slate.actors.knightA.position"),
    );

    // 5b. a tampered stored context is blamed at the store.
    const intactA = fs.readFileSync(fileA, "utf8");
    fs.writeFileSync(fileA, `${JSON.stringify({ node: "knightA" })}\n`);
    const tampered = app.perform({ performance: perf("beat-2") }).performed;
    TestValidator.predicate(
      "a tampered stored context is blamed at the slate",
      tampered.success === false &&
        hasViolation(tampered, "type", "$slate.actors.knightA.gaits"),
    );
    fs.writeFileSync(fileA, intactA);

    // 5c. a node/filename mismatch throws the keyed-slice error.
    const ghostFile = path.join(root, "actors", "ghost.json");
    fs.writeFileSync(ghostFile, `${JSON.stringify({ node: "other" })}\n`);
    TestValidator.predicate(
      "a node/filename mismatch throws the keyed-slice error",
      throwsError(
        () => app.perform({ performance: perf("beat-2") }),
        ["ghost.json", "actor node"],
      ),
    );
    fs.rmSync(ghostFile);

    // 6. eraseActor: staged refusal, absent, malformed, blank reason.
    const stagedRefusal = app.eraseActor({
      node: "knightA",
      reason: "the knight was recast",
    });
    TestValidator.predicate(
      "erasing a staged actor is refused at the committed scene",
      stagedRefusal.erased === false &&
        hasViolation(stagedRefusal.validation, "type", "$slate.scene") &&
        fs.existsSync(fileA),
    );
    const absent = app.eraseActor({ node: "phantom", reason: "never stored" });
    TestValidator.predicate(
      "erasing an absent context is refused at the node",
      absent.erased === false &&
        hasViolation(absent.validation, "type", "$input.node"),
    );
    const malformedNode = app.eraseActor({
      node: null as unknown as string,
      reason: "reject malformed actor node",
    });
    TestValidator.predicate(
      "a malformed actor node is refused",
      malformedNode.erased === false &&
        hasViolation(malformedNode.validation, "type", "$input.node"),
    );
    const blankReason = app.eraseActor({ node: "knightA", reason: " " });
    TestValidator.predicate(
      "a blank erase reason is refused",
      blankReason.erased === false &&
        hasViolation(blankReason.validation, "type", "$input.reason"),
    );
    const malformedRequest = app.eraseActor(null as never);
    TestValidator.predicate(
      "a malformed eraseActor request is refused at the root",
      malformedRequest.erased === false &&
        hasViolation(malformedRequest.validation, "type", "$input") &&
        malformedRequest.actors.length === 2,
    );

    // 6b. recast the script without knightB — the commit cascade clears the
    // scene, so the orphaned context is no longer staged anywhere and erases.
    const recast = app.commitScript({
      script: {
        logline: scriptWrite.logline,
        theme: scriptWrite.theme,
        cast: scriptWrite.cast.filter((member) => member.node !== "knightB"),
        beats: scriptWrite.beats,
      },
    });
    if (recast.committed !== true)
      throw new Error(`recast script must commit: ${JSON.stringify(recast)}`);
    const erased = app.eraseActor({
      node: "knightB",
      reason: "the second knight was cut from the recast script",
    });
    TestValidator.predicate(
      "an orphaned stale context erases exactly its own file",
      erased.erased === true &&
        !fs.existsSync(fileB) &&
        fs.existsSync(fileA) &&
        erased.actors.length === 1 &&
        erased.actors[0] === "knightA",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  // 6c. resident-only: no project throws the actionable prompt.
  TestValidator.predicate(
    "eraseActor without a project throws the openProject prompt",
    throwsError(
      () => new AutoMovieApplication().eraseActor({ node: "x", reason: "y" }),
      ["openProject"],
    ),
  );
};
