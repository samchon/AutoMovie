import {
  IAutoMovieActionSynthesizer,
  performShot,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieBlockingApplication,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  FIXTURE_BONE,
  fixtureRegionDrivesBone,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { vclose, violationCount } from "../internal/predicates";

type ICoverage = IAutoMovieBlockingApplication.ICoverageIntent;

/**
 * A pose marching the root `x` metres along model +X. The elbow rides along
 * only when the action's region owns it: a `locomote` runs on `lowerBody`,
 * which the arm chain is not part of, and a fixture that authored it anyway
 * would now be refused for content the compiler would drop (#1349). The root
 * (what this scenario actually reads) belongs to `lowerBody` either way.
 */
const march = (x: number, drivesBone: boolean) =>
  makePose(drivesBone ? [joint(FIXTURE_BONE, { flexion: 10 + x * 10 })] : [], {
    translation: { x, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  });

/**
 * A `launch` produces no actor motion, the foe marches 1 m along model +X, and
 * everything else (including the react the engine injects for a struck target)
 * gets the shared elbow clip. The last part is the point: a host synthesizer
 * answers for whatever actor id the engine hands it.
 */
const synth: IAutoMovieActionSynthesizer = (action, actor) => {
  if (action.verb === "launch") return null;
  if (actor === "foe") {
    const driven = fixtureRegionDrivesBone(action);
    return makeMotion(
      [keyframe(0, march(0, driven)), keyframe(1, march(1, driven))],
      1,
    );
  }
  return validSynthesizer(action, actor);
};

const script = makeScriptWrite({
  cast: [
    { node: "archer", character: "the archer", modelRef: "stickman" },
    { node: "foe", character: "the foe", modelRef: null },
    { node: "arrow", character: "the arrow", modelRef: null },
  ],
  beats: [
    {
      id: "beat-1",
      name: "the loosing",
      summary: "the archer looses down the lens",
      durationHint: 2,
    },
  ],
});

const staged = (() => {
  const result = stageScene(
    script,
    makeStagingWrite({
      actors: [
        { node: "archer", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
        { node: "foe", position: { x: 6, y: 0, z: 0 }, facingDeg: 180 },
        { node: "arrow", position: { x: 0, y: 1.4, z: 0 }, facingDeg: 0 },
      ],
      cameras: [
        {
          node: "cam-main",
          position: { x: 3, y: 1.6, z: 4 },
          lookAt: { kind: "node", node: "foe" },
          fovDeg: 45,
        },
        {
          node: "cam-alt",
          position: { x: 0, y: 1.6, z: -4 },
          lookAt: { kind: "node", node: "foe" },
          fovDeg: 45,
        },
        {
          node: "cam-cover",
          position: { x: -4, y: 1.6, z: 0 },
          lookAt: { kind: "node", node: "foe" },
          fovDeg: 45,
        },
      ],
    }),
  );
  if (result.success !== true) throw new Error("staging fixture must succeed");
  return result;
})();

/**
 * A loose down the lens. It carries NO `onHit`: a camera is a place to shoot
 * at, but nothing recoils it, and the engine refuses an `onHit` whose aim names
 * a camera because the react it would inject rides past the gate that keeps a
 * camera out of `shot.performances`.
 */
const looseAtCamera: IAutoMovieActionCall = {
  verb: "launch",
  actor: "archer",
  start: 0.2,
  duration: "auto",
  projectile: "arrow",
  at: { kind: "node", node: "cam-main" },
  speed: 22,
};

const frame = (
  actor: string,
  on: string,
): IAutoMovieActionCall & { verb: "frame" } => ({
  verb: "frame",
  actor,
  start: 0,
  duration: "auto",
  framing: "wide",
  move: "follow",
  on: { kind: "node", node: on },
});

/** A blocking whose hero intent matches the `frame` fixture above. */
const blockingWith = (
  coverage: ICoverage[],
): IAutoMovieBlockingApplication.IWrite => ({
  type: "write",
  beat: "beat-1",
  analysis: "the loose must read as aimed at the lens.",
  rationale: "a wide follow keeps the flight and the impact in frame.",
  actors: [{ node: "archer", beats: "looses down the lens" }],
  camera: {
    framing: "wide",
    move: "follow",
    on: { kind: "node", node: "cam-main" },
  },
  coverage,
  duration: 2,
});

const perform = (draft: IAutoMovieActionCall[], coverage?: ICoverage[]) =>
  performShot({
    script,
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft,
      revise: { review: "the loose reads.", final: null },
      duration: 2,
    }),
    synthesize: synth,
    // The production contract: no rig for a prop, and none for a camera.
    skeleton: (node) =>
      node === "arrow" || node.startsWith("cam-") ? null : createSkeleton(),
    blocking: coverage === undefined ? undefined : blockingWith(coverage),
  });

/** Every translation key of a compiled camera clip, as points. */
const keysOf = (values: readonly number[]) =>
  Array.from({ length: values.length / 3 }, (_, k) => ({
    x: values[k * 3]!,
    y: values[k * 3 + 1]!,
    z: values[k * 3 + 2]!,
  }));

/**
 * A camera is a legal positional target (#1294), so a `frame` subject, a
 * `coverage` subject, and a `launch` aim may all name one. That widening put
 * camera ids into the placement table `resolveTargetPoint` reads, while the
 * staged-facing table stays nodes-only, so a camera subject has a base point
 * and no facing. Such a subject must hold still (`at: null`) rather than rotate
 * a root under an absent quaternion, and a `follow` on it degenerates to a
 * single key.
 *
 * A camera never reaches the compiled motion map: the input gate refuses a
 * camera as the actor of any verb but `frame`, and the one path that used to
 * slip past it, a `launch` carrying `onHit` at a camera injecting a `react`
 * that names the struck camera, is refused at the aim. So the fixture's loose
 * carries no `onHit`, and the shot's performances are asserted camera-free:
 * producing a shot whose performance node is not a scene node is exactly what
 * the MCP artifact validator refuses at commit.
 *
 * The coverage half is reached the way a caller reaches it in production:
 * `perform` takes `blocking` as an ordinary argument, so a hand-written plan
 * arrives without passing through `block`. `blockBeat` now measures a coverage
 * subject against the same staged placements, cameras included, so the two
 * rungs agree; `test_film_block_beat_camera_target` pins that half.
 *
 * Scenarios:
 *
 * 1. A loose at `cam-main` plus a `follow` frame on `cam-main` assembles instead
 *    of throwing, and the follow degenerates to one key (the subject holds
 *    still), which is the documented `at: null` behaviour.
 * 2. No camera performs: `shot.performances` names only scene nodes, the invariant
 *    the artifact validator independently enforces.
 * 3. The same subject reached through the blocking's `coverage`: an alternate
 *    camera framing ANOTHER camera is legal, for the same reason the hero
 *    take's subject may be one, and its take degenerates identically.
 * 4. Negative twin: a `follow` on `foe`, an actor that has both a staged facing
 *    and root travel, still tracks. Its keys move along the marched path, so
 *    the guard flattens only the facing-less case and no legitimate follow with
 *    it.
 */
export const test_film_perform_shot_camera_subject = (): void => {
  // 1. the hero take: an animated, facing-less subject holds still.
  const hero = perform([looseAtCamera, frame("cam-alt", "cam-main")]);
  TestValidator.equals("a camera subject performs", hero.success, true);
  if (hero.success !== true) return;
  TestValidator.equals(
    "a follow on a facing-less subject keys once",
    keysOf(hero.shot.cameraMotion!.tracks[0]!.values).length,
    1,
  );

  // 2. no camera performs, in the motion map or in the shot.
  TestValidator.equals(
    "a camera never reaches the compiled motions",
    Object.keys(hero.motions).filter((node) => node.startsWith("cam-")),
    [],
  );
  TestValidator.equals(
    "every performance names a staged scene node",
    hero.shot.performances
      .map((entry) => entry.node)
      .filter((node) => !staged.scene.nodes.some((n) => n.id === node)),
    [],
  );

  // 3. the same subject through a coverage take.
  const covered = perform(
    [looseAtCamera, frame("cam-alt", "cam-main")],
    [
      {
        camera: "cam-cover",
        framing: "wide",
        move: "follow",
        on: { kind: "node", node: "cam-main" },
      },
    ],
  );
  TestValidator.equals(
    "a camera-subject coverage performs",
    covered.success,
    true,
  );
  if (covered.success !== true) return;
  TestValidator.equals(
    "an alternate camera may frame another camera",
    covered.shot.coverage!.map((take) => take.camera),
    ["cam-cover"],
  );
  TestValidator.equals(
    "the alternate keys once for the same reason",
    keysOf(covered.shot.coverage![0]!.cameraMotion!.tracks[0]!.values).length,
    1,
  );

  // 4. negative twin: a subject WITH a staged facing still tracks.
  const tracking = perform([
    {
      verb: "locomote",
      actor: "foe",
      start: 0,
      duration: 1,
      gait: "walk",
      to: { kind: "point", point: { x: 5, y: 0, z: 0 } },
    },
    frame("cam-alt", "foe"),
  ]);
  TestValidator.equals("the tracking twin performs", tracking.success, true);
  if (tracking.success !== true) return;
  TestValidator.equals(
    "the tracking twin is clean",
    violationCount(tracking),
    0,
  );
  const keys = keysOf(tracking.shot.cameraMotion!.tracks[0]!.values);
  TestValidator.equals(
    "a follow on a placed actor keys the whole span",
    keys.length > 1,
    true,
  );
  TestValidator.equals(
    "and the framing actually travels with it",
    vclose(keys[0]!, keys[keys.length - 1]!),
    false,
  );
};
