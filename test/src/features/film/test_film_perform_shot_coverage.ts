import { performShot, stageScene } from "@automovie/engine";
import {
  IAutoMovieBlockingApplication,
  IAutoMovieCameraIntent,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import {
  hasViolation,
  qclose,
  vclose,
  violationCount,
} from "../internal/predicates";

type ICoverage = IAutoMovieBlockingApplication.ICoverageIntent;

/**
 * The duel staged with three cameras on the aim height (y = 0.864) at 2 m, each
 * with a 90° vertical FOV, so every framing distance is an exact hand number:
 * `medium` shows 0.62 × 1.2 m = 0.744 m, and `tan(45°) = 1` makes the framed
 * distance 0.744 / 2 = 0.372 m along the staged bearing.
 */
const staged = (() => {
  const result = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      cameras: [
        {
          node: "cam-main",
          position: { x: 2, y: 0.864, z: 0 },
          lookAt: { kind: "node", node: "knightA" },
          fovDeg: 90,
        },
        {
          node: "cam-alt",
          position: { x: 0, y: 0.864, z: -2 },
          lookAt: { kind: "node", node: "knightA" },
          fovDeg: 90,
        },
        {
          node: "cam-wide",
          position: { x: -2, y: 0.864, z: 0 },
          lookAt: { kind: "node", node: "knightA" },
          fovDeg: 90,
        },
      ],
    }),
  );
  if (result.success !== true) throw new Error("staging fixture must succeed");
  return result;
})();

/** One valid coverage intent: cam-alt holds a medium static on knightA. */
const coverage = (over: Partial<ICoverage> = {}): ICoverage => ({
  camera: "cam-alt",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
  ...over,
});

/** Perform the beat-1 duel fixture under a blocking carrying `list`. */
const perform = (list?: ICoverage[]) =>
  performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite(),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
    blocking:
      list === undefined
        ? makeBlockingWrite()
        : makeBlockingWrite({ coverage: list }),
  });

/** The first translation key of a compiled camera clip. */
const firstKey = (values: readonly number[], k = 0) => ({
  x: values[k * 3]!,
  y: values[k * 3 + 1]!,
  z: values[k * 3 + 2]!,
});

/**
 * The production bridge of #1187's multi-camera half: `performShot` compiles
 * the blocking's `coverage` intents into alternate takes on `shot.coverage`
 * while the hero take keeps its singular `camera`/`cameraMotion` and its one
 * live `frame` election. A coverage camera never enters the election; it plays
 * its own intent across the whole beat from its own staged bearing, so a render
 * host can cut to the angle at any instant.
 *
 * The staged cameras sit at the aim height with `fovY = 90°`, so every expected
 * key is hand arithmetic: subject height 1.2 m (the fixture rig's measured rest
 * height), `medium` aim 0.72 × 1.2 = 0.864 m, framed distance (0.62 × 1.2) / 2
 * / tan(45°) = 0.372 m along the bearing from the aim point to the staged
 * camera.
 *
 * Scenarios:
 *
 * 1. One coverage intent (cam-alt, medium static on knightA) → one take naming
 *    cam-alt, its clip id `cam:beat-1:cam-alt`, both tracks on cam-alt, a
 *    single key at (0, 0.864, −0.372) rotated 180° about +Y (looking back down
 *    +Z), and one intent record `{ start: 0, medium, static, focus null, lens
 *    null }`. The hero take is untouched: camera `cam-main`, keyed at (0.372,
 *    0.864, 0).
 * 2. Two coverage intents on distinct cameras compile two takes in blocking order,
 *    and a `push-in` alternate dollies 1.25× → 0.8× of the framed distance
 *    (first key x = −0.465, last key x = −0.2976): the alternate rides the same
 *    move grammar, not a static-only shortcut.
 * 3. Boundaries: an omitted `coverage`, an explicit `[]`, and an omitted
 *    `blocking` all assemble the shot with `coverage: []` (one camera), and the
 *    hero clip stays byte-identical to the covered run (coverage never
 *    re-enters the hero solve).
 * 4. Gates at `$blocking.coverage[i]`: an unstaged camera, an empty camera id, the
 *    elected live camera itself, and a repeat all violate `.camera`; a forged
 *    framing/move violates `.framing`/`.move`; an unstaged node subject
 *    violates `.on`.
 * 5. Negative twins: two distinct staged cameras and a point-target coverage each
 *    fire nothing, so no gate over-matches a legitimate angle.
 */
export const test_film_perform_shot_coverage = (): void => {
  // 1. one coverage intent becomes one alternate take beside an untouched hero.
  const single = perform([coverage()]);
  TestValidator.equals("covered beat performs", single.success, true);
  if (single.success !== true) return;
  TestValidator.equals(
    "the hero take keeps its single live camera",
    single.shot.camera,
    "cam-main",
  );
  TestValidator.equals("one alternate take", single.shot.coverage!.length, 1);
  const take = single.shot.coverage![0]!;
  TestValidator.equals(
    "the take names its staged camera",
    take.camera,
    "cam-alt",
  );
  TestValidator.equals(
    "the take's clip is keyed to the beat and the camera",
    take.cameraMotion!.id,
    "cam:beat-1:cam-alt",
  );
  TestValidator.equals(
    "both tracks drive the covering camera",
    take.cameraMotion!.tracks.map((t) =>
      t.channel.kind === "node" ? t.channel.node : "",
    ),
    ["cam-alt", "cam-alt"],
  );
  TestValidator.equals(
    "a static alternate keys once",
    take.cameraMotion!.tracks[0]!.times,
    [0],
  );
  TestValidator.predicate(
    "the alternate frames from its own staged bearing",
    vclose(firstKey(take.cameraMotion!.tracks[0]!.values), {
      x: 0,
      y: 0.864,
      z: -0.372,
    }),
  );
  TestValidator.predicate(
    "the alternate looks back down +Z (180° about +Y)",
    qclose(
      {
        x: take.cameraMotion!.tracks[1]!.values[0]!,
        y: take.cameraMotion!.tracks[1]!.values[1]!,
        z: take.cameraMotion!.tracks[1]!.values[2]!,
        w: take.cameraMotion!.tracks[1]!.values[3]!,
      },
      { x: 0, y: 1, z: 0, w: 0 },
    ),
  );
  const expectedIntent: IAutoMovieCameraIntent[] = [
    {
      start: 0,
      framing: "medium",
      move: "static",
      focus: null,
      focalLength: null,
    },
  ];
  TestValidator.equals(
    "the take carries its own intent",
    take.cameraIntent,
    expectedIntent,
  );
  TestValidator.predicate(
    "the hero take still frames from +X",
    vclose(firstKey(single.shot.cameraMotion!.tracks[0]!.values), {
      x: 0.372,
      y: 0.864,
      z: 0,
    }),
  );

  // 2. several angles, and an alternate that moves.
  const several = perform([
    coverage(),
    coverage({ camera: "cam-wide", move: "push-in" }),
  ]);
  TestValidator.equals("multi-camera beat performs", several.success, true);
  if (several.success !== true) return;
  TestValidator.equals(
    "takes ride in blocking order",
    several.shot.coverage!.map((entry) => entry.camera),
    ["cam-alt", "cam-wide"],
  );
  const dolly = several.shot.coverage![1]!.cameraMotion!;
  TestValidator.equals(
    "a push-in alternate keys the dolly",
    dolly.tracks[0]!.times.length,
    9,
  );
  TestValidator.predicate(
    "the dolly starts at 1.25× the framed distance",
    vclose(firstKey(dolly.tracks[0]!.values), {
      x: -0.465,
      y: 0.864,
      z: 0,
    }),
  );
  TestValidator.predicate(
    "the dolly settles at 0.8× the framed distance",
    vclose(firstKey(dolly.tracks[0]!.values, 8), {
      x: -0.2976,
      y: 0.864,
      z: 0,
    }),
  );

  // 3. boundaries: the single-camera beat, in all three shapes.
  const omitted = perform();
  const emptyList = perform([]);
  const unblocked = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite(),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "a single-camera beat assembles an empty coverage list",
    [omitted, emptyList, unblocked].every(
      (result) =>
        result.success === true &&
        Array.isArray(result.shot.coverage) &&
        result.shot.coverage.length === 0,
    ),
  );
  TestValidator.equals(
    "coverage never re-enters the hero solve",
    JSON.stringify(omitted.success === true ? omitted.shot.cameraMotion : null),
    JSON.stringify(single.shot.cameraMotion),
  );

  // 4. gates.
  const ghost = perform([coverage({ camera: "cam-ghost" })]);
  TestValidator.predicate(
    "an unstaged coverage camera is a type violation",
    hasViolation(ghost, "type", "$blocking.coverage[0].camera"),
  );
  const blank = perform([coverage({ camera: "" })]);
  TestValidator.predicate(
    "an empty coverage camera id is a type violation",
    hasViolation(blank, "type", "$blocking.coverage[0].camera"),
  );
  const hero = perform([coverage({ camera: "cam-main" })]);
  TestValidator.predicate(
    "covering with the live camera is a type violation",
    hasViolation(hero, "type", "$blocking.coverage[0].camera"),
  );
  const repeated = perform([coverage(), coverage()]);
  TestValidator.predicate(
    "a repeated coverage camera is a type violation at the later entry",
    hasViolation(repeated, "type", "$blocking.coverage[1].camera"),
  );
  const badFraming = perform([coverage({ framing: "dutch" as never })]);
  TestValidator.predicate(
    "a forged coverage framing is a type violation",
    hasViolation(badFraming, "type", "$blocking.coverage[0].framing"),
  );
  const badMove = perform([coverage({ move: "dolly" as never })]);
  TestValidator.predicate(
    "a forged coverage move is a type violation",
    hasViolation(badMove, "type", "$blocking.coverage[0].move"),
  );
  const stranger = perform([coverage({ on: { kind: "node", node: "ghost" } })]);
  TestValidator.predicate(
    "an unresolvable coverage subject is a type violation",
    hasViolation(stranger, "type", "$blocking.coverage[0].on"),
  );

  // 5. negative twins: nothing fires one property away from each gate.
  TestValidator.equals(
    "two distinct staged cameras fire nothing",
    violationCount(several),
    0,
  );
  const point = perform([
    coverage({ on: { kind: "point", point: { x: 0, y: 0, z: 0.7 } } }),
  ]);
  TestValidator.equals(
    "a point-subject coverage fires nothing",
    violationCount(point),
    0,
  );
};
