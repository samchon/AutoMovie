import {
  IAutoMovieActionSynthesizer,
  performShot,
  sampleClip,
  stageScene,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import {
  createSkeleton,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { nclose, vclose } from "../internal/predicates";

/**
 * Like the shared content seam, but a `launch` produces no actor motion: it
 * animates the projectile object and schedules a react, not the shooter.
 */
const synth: IAutoMovieActionSynthesizer = (action, actor) =>
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
 * recoil is folded into the action list at the engine-computed contact, so it
 * synthesises and ROM-gates like any authored `react`.
 *
 * Scenarios:
 *
 * 1. A loose at the foe compiles: the arrow node gets one baked flight clip that
 *    lands on the foe, and the foe (nobody else) gets a performance (the
 *    injected react), proving the reaction was scheduled by the engine.
 * 2. A projectile that is not a staged node → an input violation.
 * 3. A target that does not resolve to a point (a relative direction) → a
 *    violation.
 * 4. A launch with non-positive speed yields a range violation.
 * 5. A launch with non-finite speed yields a finite-speed range violation.
 * 6. A launch with `onHit.force` outside `[0,1]` yields a range violation.
 * 7. A launch that cannot reach its target at the given speed → a range violation.
 * 8. A launch aimed at a bare point (no actor to recoil) still flies, but
 *    schedules no reaction: nobody performs.
 * 9. Two launches of one projectile node bake UNIQUE flight ids in draft order
 *    (`trajectory:arrow`, `trajectory:arrow:2`), so a volley stays committable
 *    (#989).
 * 10. A launch at a **moving** target is led: when the foe strides during the shot
 *     (a `locomote` carrying root travel), performShot resolves its animated
 *     position and aims where it will be, so the baked flight lands short of
 *     the foe's start point, and the foe still reacts, at the led contact.
 * 11. A launch fired too late to land before the shot ends yields a `range`
 *     violation on `.speed`.
 * 12. A launch whose actor is also the projectile yields `type` on `.projectile`.
 * 13. A launch aimed at its own projectile node yields `type` on `.at`.
 * 14. A moving target is still led when its locomote action uses an actor list.
 */
export const test_film_perform_shot_launch = (): void => {
  const staged = stageScene(scriptOf(), stagingOf());
  if (staged.success !== true) throw new Error("staging must succeed");

  const perform = (draft: IAutoMovieActionCall[]) =>
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
    "one object motion, the arrow's flight",
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
  // The flight is placed on the shot clock: it launches at the action's start
  // (0.2 s), spans the shot, and, via sampleClip's clamp, holds at the arrow's
  // staged origin before the loose rather than starting mid-air at shot t = 0.
  const times = flight.tracks[0]!.times;
  TestValidator.equals("the flight spans the shot", flight.duration, 2);
  TestValidator.predicate(
    "the flight launches at the action's start",
    nclose(times[0]!, 0.2),
  );
  TestValidator.predicate(
    "and lands within the shot",
    times[times.length - 1]! > 0.2 && times[times.length - 1]! < 2,
  );
  const preLaunch = sampleClip(flight, 0).get("node:arrow:translation")!.value;
  TestValidator.predicate(
    "before the loose the arrow holds at its staged origin",
    vclose(
      { x: preLaunch[0]!, y: preLaunch[1]!, z: preLaunch[2]! },
      { x: 0, y: 1.4, z: 0 },
      1e-9,
    ),
  );
  TestValidator.equals(
    "only the struck foe performs, the engine-scheduled react",
    ok.shot.performances.map((p) => p.node),
    ["foe"],
  );

  const launchEvents = ok.shot.events ?? [];
  TestValidator.equals(
    "the shot carries contact, hit, and fall events",
    launchEvents.map((event) => event.kind),
    ["contact", "hit", "fall"],
  );
  TestValidator.predicate(
    "the contact event lands with the projectile",
    launchEvents[0]!.source === "collisionSolver" &&
      launchEvents[0]!.time === times[times.length - 1] &&
      launchEvents[0]!.actionIndex === 0 &&
      launchEvents[0]!.target === "foe" &&
      launchEvents[0]!.object === "arrow",
  );
  TestValidator.predicate(
    "the hit event drives the downstream reaction",
    launchEvents[1]!.source === "impactOutput" &&
      launchEvents[1]!.reaction === "foe" &&
      launchEvents[1]!.actionIndex === 0 &&
      nclose(launchEvents[1]!.time, times[times.length - 1]!),
  );
  TestValidator.predicate(
    "the fall event records the unbalance response",
    launchEvents[2]!.kind === "fall" &&
      launchEvents[2]!.actor === "foe" &&
      launchEvents[2]!.reaction === "foe",
  );
  const faster = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: 30,
      onHit: { force: 0.6, unbalance: true },
    },
  ]);
  TestValidator.equals("a faster hit still performs", faster.success, true);
  if (faster.success === true) {
    const fastHit = faster.shot.events!.find((event) => event.kind === "hit")!;
    const okHit = launchEvents.find((event) => event.kind === "hit")!;
    TestValidator.predicate(
      "changing hit time moves the reaction event",
      fastHit.time < okHit.time,
    );
    TestValidator.predicate(
      "the shifted hit still schedules the struck actor",
      fastHit.reaction === "foe" &&
        faster.shot.performances.some((p) => p.node === "foe"),
    );
  }

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

  // 4. the speed itself must be positive
  const stopped = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: 0,
    },
  ]);
  TestValidator.equals("a stopped launch fails", stopped.success, false);
  if (stopped.success === false)
    TestValidator.predicate(
      "the violation names the non-positive speed",
      stopped.violations.some(
        (v) => v.kind === "range" && v.path.includes(".speed"),
      ),
    );

  // 5. the speed itself must be finite
  const infiniteSpeed = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: Number.POSITIVE_INFINITY,
    },
  ]);
  TestValidator.equals(
    "an infinite-speed launch fails",
    infiniteSpeed.success,
    false,
  );
  if (infiniteSpeed.success === false)
    TestValidator.predicate(
      "the violation requires finite speed",
      infiniteSpeed.violations.some(
        (v) =>
          v.kind === "range" &&
          v.path.includes(".speed") &&
          v.expected.includes("finite"),
      ),
    );

  // 6. a launch's scheduled reaction force must already be in range
  const heavyHit = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: 22,
      onHit: { force: 1.5 },
    },
  ]);
  TestValidator.equals(
    "an oversized onHit force fails",
    heavyHit.success,
    false,
  );
  if (heavyHit.success === false)
    TestValidator.predicate(
      "the violation names the onHit force",
      heavyHit.violations.some(
        (v) => v.kind === "range" && v.path.includes(".onHit.force"),
      ),
    );

  // 7. the shot must reach the target at the given speed
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

  // 8. a bare-point aim flies but schedules no reaction (no actor to recoil)
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
    TestValidator.equals(
      "the point aim records contact but no hit",
      (pointed.shot.events ?? []).map((event) => event.kind),
      ["contact"],
    );
    TestValidator.equals(
      "the point contact has no target actor",
      pointed.shot.events![0]!.target,
      null,
    );
  }

  // 9. the computed hit must still land inside the shot window
  const late = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 1.9,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: 22,
      onHit: { force: 0.6 },
    },
  ]);
  TestValidator.equals("a late landing launch fails", late.success, false);
  if (late.success === false)
    TestValidator.predicate(
      "the violation names the speed/timing",
      late.violations.some(
        (v) => v.kind === "range" && v.path.includes(".speed"),
      ),
    );

  // 10. the projectile is the flown object, not the launching actor
  const projectileActor = perform([
    {
      verb: "launch",
      actor: "arrow",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: 22,
    },
  ]);
  TestValidator.equals(
    "projectile-as-actor launch fails",
    projectileActor.success,
    false,
  );
  if (projectileActor.success === false)
    TestValidator.predicate(
      "the violation names the projectile",
      projectileActor.violations.some(
        (v) => v.kind === "type" && v.path.includes(".projectile"),
      ),
    );

  // 11. a projectile cannot be aimed at its own staged node
  const selfTarget = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: "auto",
      projectile: "arrow",
      at: { kind: "node", node: "arrow" },
      speed: 4,
    },
  ]);
  TestValidator.equals(
    "projectile self-target launch fails",
    selfTarget.success,
    false,
  );
  if (selfTarget.success === false)
    TestValidator.predicate(
      "the violation names the target",
      selfTarget.violations.some(
        (v) => v.kind === "type" && v.path.includes(".at"),
      ),
    );

  // 13. a moving target is led. The foe strides (a locomote whose baked motion
  // carries root travel); performShot resolves its animated world position and
  // leads the aim, so the flight lands short of the foe's staged x = 6 (the
  // foe, facing 180, advances toward the archer as the arrow flies).
  const rootAt = (x: number): IAutoMovieTransform => ({
    translation: { x, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  });
  const movingSynth: IAutoMovieActionSynthesizer = (action, actor) =>
    action.verb === "launch"
      ? null
      : action.verb === "locomote" && actor === "foe"
        ? makeMotion(
            [
              keyframe(0, makePose([], rootAt(0))),
              keyframe(2, makePose([], rootAt(4))),
            ],
            2,
          )
        : validSynthesizer(action, actor);
  const led = performShot({
    script: scriptOf(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        {
          verb: "locomote",
          actor: "foe",
          start: 0,
          duration: 2,
          gait: "walk",
          to: { kind: "point", point: { x: 2, y: 0, z: 0 } },
        },
        {
          verb: "launch",
          actor: "archer",
          start: 0.1,
          duration: "auto",
          projectile: "arrow",
          at: { kind: "node", node: "foe" },
          speed: 22,
          onHit: { force: 0.6, unbalance: true },
        },
      ],
      revise: { review: "the loose leads the striding foe.", final: null },
      duration: 2,
    }),
    synthesize: movingSynth,
    skeleton: (node) => (node === "arrow" ? null : createSkeleton()),
  });
  TestValidator.equals("the leading launch performs", led.success, true);
  if (led.success === true) {
    const lead = led.shot.objectMotions[0]!;
    const lv = lead.tracks[0]!.values;
    TestValidator.predicate(
      "the flight leads the approaching foe, lands short of its start (x < 6)",
      lv[lv.length - 3]! < 6 - 0.1,
    );
    TestValidator.predicate(
      "the struck foe still reacts at the led contact",
      led.shot.performances.some((p) => p.node === "foe"),
    );
  }

  // 12. actor-list locomotion is still that actor's motion, so launch leading
  // must use the same membership semantics as compilePerformance.
  const listedTarget = performShot({
    script: scriptOf(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-1",
      draft: [
        {
          verb: "locomote",
          actor: ["foe"],
          start: 0,
          duration: 2,
          gait: "walk",
          to: { kind: "point", point: { x: 2, y: 0, z: 0 } },
        },
        {
          verb: "launch",
          actor: "archer",
          start: 0.1,
          duration: "auto",
          projectile: "arrow",
          at: { kind: "node", node: "foe" },
          speed: 22,
          onHit: { force: 0.6, unbalance: true },
        },
      ],
      revise: {
        review: "the loose leads the listed striding foe.",
        final: null,
      },
      duration: 2,
    }),
    synthesize: movingSynth,
    skeleton: (node) => (node === "arrow" ? null : createSkeleton()),
  });
  TestValidator.equals(
    "actor-list moving target launch performs",
    listedTarget.success,
    true,
  );
  if (listedTarget.success === true) {
    const lead = listedTarget.shot.objectMotions[0]!;
    const lv = lead.tracks[0]!.values;
    TestValidator.predicate(
      "the actor-list target is led too",
      lv[lv.length - 3]! < 6 - 0.1,
    );
  }

  // 10. a volley: two launches of one projectile bake unique flight ids
  const volley = perform([
    {
      verb: "launch",
      actor: "archer",
      start: 0.2,
      duration: 0.5,
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: 22,
    },
    {
      verb: "launch",
      actor: "archer",
      start: 1.2,
      duration: 0.5,
      projectile: "arrow",
      at: { kind: "node", node: "foe" },
      speed: 22,
    },
  ]);
  TestValidator.equals("the volley performs", volley.success, true);
  if (volley.success === true)
    TestValidator.equals(
      "volley flights carry unique draft-ordered ids",
      volley.shot.objectMotions
        .map((c) => c.id)
        .sort((a, b) => a.localeCompare(b)),
      ["trajectory:arrow", "trajectory:arrow:2"],
    );
};
