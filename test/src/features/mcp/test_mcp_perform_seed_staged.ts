import {
  IAutoMovieBeatEndState,
  IAutoMovieGait,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpMotion,
  IAutoMovieMcpPerformedShot,
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
import { nclose } from "../internal/predicates";

const script = makeScriptWrite({
  beats: [
    { id: "beat-1", name: "one", summary: "the charge", durationHint: 2 },
    { id: "beat-2", name: "two", summary: "the aftermath", durationHint: 2 },
  ],
});

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

/** A context whose per-beat opening the caller chooses to carry or omit. */
const actorContext = (opening: {
  position?: IAutoMovieVector3;
  facingDeg?: number;
}): IAutoMovieMcpActorContext => {
  const rig = createSkeleton();
  return {
    skeleton: rig.id,
    gaits: [WALK],
    speed: 1,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig,
    ...opening,
  };
};

/** Where staging puts each knight: the answer `commitScene` already stored. */
const PLACEMENTS = {
  knightA: { position: { x: 0.4, y: 0, z: -0.2 }, facingDeg: 0 },
  knightB: { position: { x: -0.3, y: 0, z: 0.1 }, facingDeg: 0 },
} as const;

const staging = makeStagingWrite({
  actors: [
    { node: "knightA", ...PLACEMENTS.knightA },
    { node: "knightB", ...PLACEMENTS.knightB },
  ],
});

/** A solvable beat: both knights walk to the same point. */
const walkBeat = (beat: string) =>
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

/** A head aim at a fixed world point: the facing seed's visible consequence. */
const lookBeat = () =>
  makePerformanceWrite({
    beat: "beat-1",
    draft: [
      {
        verb: "lookAt",
        actor: "knightA",
        start: 0,
        duration: 2,
        to: { kind: "point", point: { x: 0, y: 1.6, z: 1 } },
      },
    ],
  });

/** The head twist of largest magnitude in a compiled clip, signed. */
const headTwist = (motion: IAutoMovieMcpMotion): number => {
  let extreme = 0;
  for (const key of motion.keyframes)
    for (const joint of key.pose.joints)
      if (
        joint.bone === "head" &&
        joint.twist !== null &&
        Math.abs(joint.twist) > Math.abs(extreme)
      )
        extreme = joint.twist;
  return extreme;
};

/** True when the refusal at `path` states every fragment and no forbidden one. */
const says = (
  result: IAutoMovieMcpPerformedShot,
  path: string,
  fragments: readonly string[],
  forbidden: readonly string[] = [],
): boolean =>
  result.success === false &&
  result.violations.some(
    (item) =>
      item.path === path &&
      fragments.every((fragment) => item.expected.includes(fragment)) &&
      forbidden.every((fragment) => !item.expected.includes(fragment)),
  );

/** True when nothing was refused at `path`. */
const silentAt = (result: IAutoMovieMcpPerformedShot, path: string): boolean =>
  result.success === true ||
  result.violations.every((item) => item.path !== path);

/** A clip's compiled head twist, or a loud failure when the aim was dropped. */
const aimOf = (
  motions: Record<string, IAutoMovieMcpMotion>,
  node: string,
): number => {
  if (!(node in motions))
    throw new Error(`the head aim of ${node} was never synthesized`);
  return headTwist(motions[node]!);
};

/** Open a resident project already carrying the committed script and scene. */
const openStaged = (
  root: string,
  placement: typeof staging,
): AutoMovieApplication => {
  const app = new AutoMovieApplication();
  app.openProject({ root });
  app.commitScript({
    script: {
      logline: script.logline,
      theme: script.theme,
      cast: script.cast,
      beats: script.beats,
    },
  });
  const staged = app.stage({ script, staging: placement }).staged;
  if (staged.success !== true) throw new Error("staging fixture must succeed");
  app.commitScene({
    scene: staged.scene,
    models: [...new Set(staged.scene.nodes.map((node) => node.model))].map(
      (id) => ({ id, skeleton: null }),
    ),
  });
  return app;
};

/**
 * A film's FIRST beat opens on the placement `commitScene` already stored
 * (#1295). The resident `perform` therefore seeds an omitted `position` from
 * that node's staged transform translation and an omitted `facingDeg` from the
 * same transform's rotation, instead of refusing with a `commitBeatEnd` hint
 * that a first beat can never follow. Nothing is invented: an actor that is in
 * neither the committed scene nor a committed end-state is still refused, and
 * so is a later beat whose predecessor's end was never committed, because the
 * staged placement is where the film opened, not where the actor now stands.
 *
 * Scenarios:
 *
 * 1. A one-beat resident perform whose contexts omit both openings compiles the
 *    SAME shot and motions as the twin that restates the staged placement, so
 *    the agent never re-sends what it just committed.
 * 2. Facing comes from the staged rotation, not from zero: an actor staged at 20°
 *    aiming at a point due north twists its head by the hand-computed −20°,
 *    while the twin that passes `facingDeg: 0` explicitly twists by 0. That is
 *    both the rotation-decode pin and the explicit-override pin.
 * 3. An explicit `position` wins over the staged seed while the omitted facing
 *    still seeds, and the overridden shot differs from the fully seeded one.
 * 4. Nothing to seed is still refused, split by cause with the remedy that fits:
 *    an actor the committed scene does not place on a beat with no predecessor
 *    (stage it, never `commitBeatEnd`); a later beat whose predecessor's end
 *    was never committed, even for a STAGED actor (`commitBeatEnd`, the case
 *    that hint fits); and a committed end that records no state for the actor
 *    (pass the opening explicitly, never `commitBeatEnd`).
 */
export const test_mcp_perform_seed_staged = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-seedstage-"));
  const turned = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-seedturn-"));
  try {
    const app = openStaged(root, staging);

    // 1. the reported repro: a first beat needs no restatement.
    const seeded = app.perform({
      performance: walkBeat("beat-1"),
      actors: { knightA: actorContext({}), knightB: actorContext({}) },
      response: "full",
    }).performed;
    if (seeded.success !== true)
      throw new Error(
        `a first beat must seed from the staged placement: ${JSON.stringify(seeded)}`,
      );
    const restated = app.perform({
      performance: walkBeat("beat-1"),
      actors: {
        knightA: actorContext(PLACEMENTS.knightA),
        knightB: actorContext(PLACEMENTS.knightB),
      },
      response: "full",
    }).performed;
    if (restated.success !== true)
      throw new Error("the restated twin must perform");
    TestValidator.equals(
      "the staged seed compiles the restated placement's shot",
      { shot: seeded.shot, motions: seeded.motions },
      { shot: restated.shot, motions: restated.motions },
    );

    // 2. the facing seed decodes the staged ROTATION, and an explicit facing
    // still wins over it.
    const turnedApp = openStaged(
      turned,
      makeStagingWrite({
        actors: [
          { node: "knightA", position: { x: 0, y: 0, z: 0 }, facingDeg: 20 },
          { node: "knightB", position: { x: 0, y: 0, z: 0.7 }, facingDeg: 180 },
        ],
      }),
    );
    const aimed = turnedApp.perform({
      performance: lookBeat(),
      actors: { knightA: actorContext({}) },
      response: "full",
    }).performed;
    if (aimed.success !== true)
      throw new Error(
        `the staged-facing aim must perform: ${JSON.stringify(aimed)}`,
      );
    TestValidator.predicate(
      "an actor staged at 20 degrees aims from 20 degrees, not from zero",
      nclose(aimOf(aimed.motions, "knightA"), -20, 1e-6),
    );
    const unturned = turnedApp.perform({
      performance: lookBeat(),
      actors: { knightA: actorContext({ facingDeg: 0 }) },
      response: "full",
    }).performed;
    if (unturned.success !== true)
      throw new Error("the explicit-facing twin must perform");
    TestValidator.predicate(
      "an explicit facingDeg wins over the staged rotation",
      nclose(aimOf(unturned.motions, "knightA"), 0, 1e-6),
    );

    // 3. an explicit position wins while the omitted facing still seeds.
    const moved: IAutoMovieVector3 = { x: 1.5, y: 0, z: 1.5 };
    const overridden = app.perform({
      performance: walkBeat("beat-1"),
      actors: {
        knightA: actorContext({ position: moved }),
        knightB: actorContext({}),
      },
      response: "full",
    }).performed;
    const overriddenTwin = app.perform({
      performance: walkBeat("beat-1"),
      actors: {
        knightA: actorContext({ position: moved, facingDeg: 0 }),
        knightB: actorContext(PLACEMENTS.knightB),
      },
      response: "full",
    }).performed;
    if (overridden.success !== true || overriddenTwin.success !== true)
      throw new Error("the overridden perform must succeed");
    TestValidator.equals(
      "an explicit position wins while the omitted facing still seeds",
      { shot: overridden.shot, motions: overridden.motions },
      { shot: overriddenTwin.shot, motions: overriddenTwin.motions },
    );
    TestValidator.predicate(
      "the overridden opening is not the staged one",
      JSON.stringify(overridden.motions) !== JSON.stringify(seeded.motions),
    );

    // 4a. no predecessor and no staged placement: staging is the remedy, and
    // commitBeatEnd is the one instruction that cannot be followed here.
    const unstaged = app.perform({
      performance: walkBeat("beat-1"),
      actors: {
        knightA: actorContext({}),
        herald: actorContext({ position: { x: 0, y: 0, z: -0.4 } }),
      },
    }).performed;
    TestValidator.predicate(
      "an unstaged actor on a first beat is refused, without the commitBeatEnd hint",
      says(
        unstaged,
        "$input.actors.herald.facingDeg",
        [
          "has no predecessor beat to inherit facingDeg from",
          "the committed scene does not place herald",
          "stage it (commitScene)",
        ],
        ["commitBeatEnd"],
      ) && silentAt(unstaged, "$input.actors.knightA.position"),
    );

    // 4b. a later beat whose predecessor's end was never committed is refused
    // even for a STAGED actor: the staged placement seeds the first beat only.
    const uncommitted = app.perform({
      performance: walkBeat("beat-2"),
      actors: { knightA: actorContext({}) },
    }).performed;
    TestValidator.predicate(
      "a later beat does not fall back to the staged placement",
      says(uncommitted, "$input.actors.knightA.position", [
        'resumes beat "beat-1", whose end was never committed',
        "commitBeatEnd",
      ]) &&
        says(uncommitted, "$input.actors.knightA.facingDeg", ["commitBeatEnd"]),
    );

    // 4c. a committed end that never recorded this actor is a third fault:
    // the actor enters mid-film, so only an explicit opening can answer.
    const shotCommit = app.commitShot({
      shot: {
        id: "shot:beat-1",
        name: null,
        scene: seeded.shot.scene,
        camera: seeded.shot.camera,
        cameraMotion: null,
        performances: [],
        objectMotions: [],
        duration: 2,
      },
    });
    if (shotCommit.committed !== true)
      throw new Error("shot fixture must commit");
    const beatOneEnd: IAutoMovieBeatEndState = {
      beat: "beat-1",
      shot: "shot:beat-1",
      actors: [
        {
          node: "knightA",
          transform: {
            ...IDENTITY_TRANSFORM,
            translation: { x: 0.1, y: 0, z: 0.25 },
          },
          facing: { x: 0, y: 0, z: 1 },
          pose: null,
          motion: null,
          localTime: 2,
          gaitPhase: null,
          rootVelocity: null,
          footPlants: null,
          mount: null,
        },
      ],
    };
    const endCommit = app.commitBeatEnd({ beatEnd: beatOneEnd });
    if (endCommit.committed !== true)
      throw new Error(
        `beatEnd fixture must commit: ${JSON.stringify(endCommit)}`,
      );
    const unrecorded = app.perform({
      performance: walkBeat("beat-2"),
      actors: { knightA: actorContext({}), knightB: actorContext({}) },
    }).performed;
    TestValidator.predicate(
      "an actor the committed end never recorded is refused on its own terms",
      says(
        unrecorded,
        "$input.actors.knightB.position",
        [
          'the committed end of beat "beat-1" records no state for actor knightB',
          "pass position explicitly",
        ],
        ["commitBeatEnd"],
      ) && silentAt(unrecorded, "$input.actors.knightA.position"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(turned, { recursive: true, force: true });
  }
};
