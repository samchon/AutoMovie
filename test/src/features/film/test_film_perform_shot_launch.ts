import {
  IAutoFilmActionSynthesizer,
  performShot,
  stageScene,
} from "@autofilm/engine";
import { IAutoFilmActionCall } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";

/**
 * Like the shared content seam, but a `launch` produces no actor motion — it
 * animates the projectile object and schedules a react, not the shooter.
 */
const synth: IAutoFilmActionSynthesizer = (action, actor) =>
  action.verb === "launch" ? null : validSynthesizer(action, actor);

const scriptOf = () =>
  makeScriptWrite({
    cast: [
      { node: "archer", character: "the archer", modelRef: "stickman" },
      { node: "foe", character: "the foe", modelRef: null },
      { node: "arrow", character: "the arrow", modelRef: null },
    ],
    beats: [
      {
        id: "beat-1",
        name: "the loosing",
        summary: "the archer looses at the foe",
        durationHint: 2,
      },
    ],
  });

const stagingOf = () =>
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
    ],
  });

/**
 * Wires the `launch` verb through the PERFORMANCE consumer end to end: the
 * projectile's flight becomes a shot `objectMotion`, and the struck target's
 * recoil is folded into the action list at the engine-computed contact — so it
 * synthesises and ROM-gates like any authored `react`.
 *
 * Scenarios:
 *
 * 1. A loose at the foe compiles: the arrow node gets one baked flight clip that
 *    lands on the foe, and the foe — nobody else — gets a performance (the
 *    injected react), proving the reaction was scheduled by the engine.
 * 2. A projectile that is not a staged node → an input violation.
 * 3. A target that does not resolve to a point (a relative direction) → a
 *    violation.
 * 4. A launch that cannot reach its target at the given speed → a range violation.
 * 5. A launch aimed at a bare point (no actor to recoil) still flies, but
 *    schedules no reaction — nobody performs.
 */
export const test_film_perform_shot_launch = (): void => {
  const staged = stageScene(scriptOf(), stagingOf());
  if (staged.success !== true) throw new Error("staging must succeed");

  const perform = (draft: IAutoFilmActionCall[]) =>
    performShot({
      script: scriptOf(),
      staged,
      performance: makePerformanceWrite({
        beat: "beat-1",
        draft,
        revise: {
          review: "the loose reads; the hit lands downrange.",
          final: null,
        },
        duration: 2,
      }),
      synthesize: synth,
      skeleton: (node) => (node === "arrow" ? null : createSkeleton()),
    });

  // 1. a valid loose: the arrow flies and the foe is scheduled to react
  const ok = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: 22,
      onHit: { force: 0.6, unbalance: true },
    },
    {
      verb: "frame",
      actor: "cam-main",
      start: 0,
      duration: "auto",
      framing: "wide",
      move: "static",
      on: { kind: "node", node: "foe" },
    },
  ]);
  TestValidator.equals("the launch performs", ok.success, true);
  if (ok.success !== true) return;

  TestValidator.equals(
    "one object motion — the arrow's flight",
    ok.shot.objectMotions.length,
    1,
  );
  const flight = ok.shot.objectMotions[0]!;
  TestValidator.equals(
    "the flight is the arrow's clip",
    flight.id,
    "trajectory:arrow",
  );
  TestValidator.equals(
    "the flight drives the arrow node",
    flight.tracks.map((t) => (t.channel.kind === "node" ? t.channel.node : "")),
    ["arrow", "arrow"],
  );
  const vals = flight.tracks[0]!.values;
  TestValidator.predicate(
    "the flight lands on the foe",
    Math.hypot(
      vals[vals.length - 3]! - 6,
      vals[vals.length - 2]! - 0,
      vals[vals.length - 1]! - 0,
    ) < 5e-3,
  );
  TestValidator.equals(
    "only the struck foe performs — the engine-scheduled react",
    ok.shot.performances.map((p) => p.node),
    ["foe"],
  );

  // 2. the projectile must be a staged scene object
  const unstaged = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "ghost",
      at: { kind: "node", node: "foe" },
      speed: 22,
    },
  ]);
  TestValidator.equals("an unstaged projectile fails", unstaged.success, false);
  if (unstaged.success === false)
    TestValidator.predicate(
      "the violation names the projectile",
      unstaged.violations.some((v) => v.path.includes(".projectile")),
    );

  // 3. the aim must resolve to a point
  const relative = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "direction", headingDeg: 90 },
      speed: 22,
    },
  ]);
  TestValidator.equals("an unresolvable target fails", relative.success, false);
  if (relative.success === false)
    TestValidator.predicate(
      "the violation names the target",
      relative.violations.some((v) => v.path.includes(".at")),
    );

  // 4. the shot must reach the target at the given speed
  const short = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: 2,
    },
  ]);
  TestValidator.equals("an out-of-range launch fails", short.success, false);
  if (short.success === false)
    TestValidator.predicate(
      "the violation names the speed",
      short.violations.some((v) => v.path.includes(".speed")),
    );

  // 5. a bare-point aim flies but schedules no reaction (no actor to recoil)
  const pointed = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "point", point: { x: 6, y: 0.2, z: 0 } },
      speed: 22,
      onHit: { force: 0.9, unbalance: true },
    },
  ]);
  TestValidator.equals(
    "a point-aimed launch still performs",
    pointed.success,
    true,
  );
  if (pointed.success === true) {
    TestValidator.equals(
      "the arrow still flies",
      pointed.shot.objectMotions.length,
      1,
    );
    TestValidator.equals(
      "but nobody is scheduled to react",
      pointed.shot.performances.length,
      0,
    );
  }
};
