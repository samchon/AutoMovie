import {
  IAutoMovieBeatEndActorState,
  IAutoMovieBeatEndState,
  IAutoMovieGait,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
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
import { hasViolation } from "../internal/predicates";

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

/** A solvable performance: one walk both knights share (no IK rest frames). */
const perf = (beat: string) =>
  makePerformanceWrite({
    beat,
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

/** A context whose `position`/`facingDeg` the caller chooses to carry or omit. */
const actorContext = (opening: {
  position?: IAutoMovieVector3;
  facingDeg?: number;
}): IAutoMovieMcpActorContext => {
  const skeleton = createSkeleton();
  return {
    skeleton: skeleton.id,
    gaits: [walk],
    speed: 1,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig: skeleton,
    ...opening,
  };
};

/** Where and how each knight ended beat-1 — the seed source of truth. */
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

const beatOneEnd: IAutoMovieBeatEndState = {
  beat: "beat-1",
  shot: "shot:beat-1",
  actors: [endActor("knightA"), endActor("knightB")],
};

/**
 * Resident `perform` continuity-seed (#1176): an actor context that omits
 * `position`/`facingDeg` inherits them from the previous beat's committed
 * end-state, so a walking character resumes exactly where — and facing exactly
 * how — the last beat left it, without the caller round-tripping `getBeatEnd`
 * by hand.
 *
 * Scenarios:
 *
 * 1. With beat-1's end committed, a beat-2 resident perform whose contexts omit
 *    both fields compiles the SAME motions as one that passes the end-state
 *    values explicitly — the facing vector→degrees conversion included.
 * 2. Partial omission seeds only the missing field; the explicit field wins.
 * 3. Nothing to inherit is refused with the commitBeatEnd hint, per missing field:
 *    a first beat (no predecessor) and an uncommitted predecessor.
 * 4. Malformed registries and context entries pass through the seeder to the
 *    actor-registry gate; an EXPLICIT call may never omit the fields.
 */
export const test_mcp_perform_seed = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-perfseed-"));
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

    // 3a. beat-1 has no predecessor: every omitted field is unseedable, and the
    // refusal names each one (both omitted / position-only / facing-only).
    const firstBeat = app.perform({
      performance: perf("beat-1"),
      actors: {
        knightA: actorContext({}),
        knightB: actorContext({ facingDeg: 0 }),
        herald: actorContext({ position: { x: 0, y: 0, z: -0.4 } }),
      },
    }).performed;
    TestValidator.predicate(
      "a first beat cannot seed and refuses per omitted field",
      firstBeat.success === false &&
        hasViolation(firstBeat, "type", "$input.actors.knightA.position") &&
        hasViolation(firstBeat, "type", "$input.actors.knightA.facingDeg") &&
        hasViolation(firstBeat, "type", "$input.actors.knightB.position") &&
        hasViolation(firstBeat, "type", "$input.actors.herald.facingDeg"),
    );

    // 3b. beat-2 before commitBeatEnd: the predecessor exists but its end was
    // never committed, so there is still nothing to inherit.
    const uncommitted = app.perform({
      performance: perf("beat-2"),
      actors: { knightA: actorContext({ facingDeg: 90 }) },
    }).performed;
    TestValidator.predicate(
      "an uncommitted predecessor seeds nothing and refuses",
      uncommitted.success === false &&
        hasViolation(uncommitted, "type", "$input.actors.knightA.position"),
    );

    // the ladder wants beat-1's shot before its end-state.
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
    const endCommit = app.commitBeatEnd({ beatEnd: beatOneEnd });
    if (endCommit.committed !== true)
      throw new Error(
        `beatEnd fixture must commit: ${JSON.stringify(endCommit)}`,
      );

    // 1. fully-omitted contexts seed both fields from beat-1's end and compile
    // the same motions the explicit continuation does.
    const seeded = app.perform({
      performance: perf("beat-2"),
      actors: { knightA: actorContext({}), knightB: actorContext({}) },
    }).performed;
    if (seeded.success !== true)
      throw new Error(`seeded perform must succeed: ${JSON.stringify(seeded)}`);
    const explicit = app.perform({
      performance: perf("beat-2"),
      actors: {
        knightA: actorContext(ENDINGS.knightA),
        knightB: actorContext(ENDINGS.knightB),
      },
    }).performed;
    if (explicit.success !== true)
      throw new Error("explicit continuation must succeed");
    TestValidator.equals(
      "the seeded shot compiles the explicit continuation's motions",
      { shot: seeded.shot, motions: seeded.motions },
      { shot: explicit.shot, motions: explicit.motions },
    );

    // 2. partial omission seeds only the missing field, and an explicit value
    // wins over the committed end: knightA keeps its own 270° (the ending says
    // 90°) while its position is seeded; knightB keeps its own repositioning
    // while its facing is seeded. The twin passes everything explicitly and
    // must compile identically.
    const repositioned: IAutoMovieVector3 = { x: 0.3, y: 0, z: -0.15 };
    const partial = app.perform({
      performance: perf("beat-2"),
      actors: {
        knightA: actorContext({ facingDeg: 270 }),
        knightB: actorContext({ position: repositioned }),
      },
    }).performed;
    const partialTwin = app.perform({
      performance: perf("beat-2"),
      actors: {
        knightA: actorContext({
          position: ENDINGS.knightA.position,
          facingDeg: 270,
        }),
        knightB: actorContext({
          position: repositioned,
          facingDeg: ENDINGS.knightB.facingDeg,
        }),
      },
    }).performed;
    if (partial.success !== true || partialTwin.success !== true)
      throw new Error("partially-seeded perform must succeed");
    TestValidator.equals(
      "a partial omission seeds only the missing field and explicit values win",
      { shot: partial.shot, motions: partial.motions },
      { shot: partialTwin.shot, motions: partialTwin.motions },
    );

    // 4. malformed payloads fall through the seeder to the registry gate...
    const nonRecordRegistry = app.perform({
      performance: perf("beat-2"),
      actors: 7 as never,
    }).performed;
    TestValidator.predicate(
      "a non-object registry passes the seeder and fails the registry gate",
      nonRecordRegistry.success === false &&
        hasViolation(nonRecordRegistry, "type", "$input.actors"),
    );
    const nonRecordContext = app.perform({
      performance: perf("beat-2"),
      actors: { knightA: 5 as never },
    }).performed;
    TestValidator.predicate(
      "a non-object context passes the seeder and fails the registry gate",
      nonRecordContext.success === false &&
        hasViolation(nonRecordContext, "type", "$input.actors.knightA"),
    );
    // ...and the EXPLICIT form still demands both fields itself.
    const explicitOmission = app.perform({
      script: scriptWrite,
      staged,
      performance: perf("beat-2"),
      actors: { knightA: actorContext({ facingDeg: 90 }) },
    }).performed;
    TestValidator.predicate(
      "an explicit perform may not omit position",
      explicitOmission.success === false &&
        hasViolation(
          explicitOmission,
          "type",
          "$input.actors.knightA.position",
        ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};
