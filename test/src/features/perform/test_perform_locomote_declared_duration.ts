import {
  IAutoMovieActorContext,
  compilePerformance,
  makeActorSynthesizer,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieGait,
  IAutoMovieMotion,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/** One second per cycle, so the natural sizing is countable by hand. */
const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [
    { bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 },
    { bone: "rightUpperLeg", phase: 0.5, duty: 0.5, amplitude: 25 },
  ],
};

/** 1 m/s over a 1 s cycle: the walk covers exactly one metre per stride. */
const HERO: IAutoMovieActorContext = {
  skeleton: "skeleton-1",
  gaits: [WALK],
  position: { x: 0, y: 0, z: 0 },
  speed: 1,
  facingDeg: 0,
  eyeHeight: 1.6,
  restPose: makePose([joint("spine", { flexion: 0 })]),
};

/** Three metres straight ahead: three whole cycles, 3.0 s of natural walk. */
const EXIT: IAutoMovieVector3 = { x: 0, y: 0, z: 3 };

const NODES = new Map<string, IAutoMovieVector3>([
  ["hero", { x: 0, y: 0, z: 0 }],
  ["exit", EXIT],
]);

const synth = makeActorSynthesizer(
  new Map<string, IAutoMovieActorContext>([["hero", HERO]]),
  NODES,
);

const walkTo = (
  duration: number | "auto",
  start = 0,
): IAutoMovieActionCall => ({
  verb: "locomote",
  actor: "hero",
  gait: "walk",
  to: { kind: "node", node: "exit" },
  start,
  duration,
});

const stepInPlace = (duration: number | "auto"): IAutoMovieActionCall => ({
  verb: "locomote",
  actor: "hero",
  gait: "walk",
  // a relative target resolves to no point, so the gait steps where it stands
  to: { kind: "direction", headingDeg: 90 },
  start: 0,
  duration,
});

/** Where the travelling root ends up, in the actor's model space. */
const arrival = (motion: IAutoMovieMotion): number => {
  const last = motion.keyframes[motion.keyframes.length - 1]!;
  return last.pose.root!.translation.z;
};

/**
 * An explicit `duration` on a `locomote` is the action's span, not advice.
 *
 * The engine sized every walk from distance and the actor's speed and discarded
 * the number the author wrote: a walk declared 7.5 s compiled to 3.0 s with no
 * violation, no warning, and nothing in the guide corpus saying it would
 * (#1366). That is the substitute-in-silence shape #1349 refused for channels,
 * moved from content to timing, and `duration` is the one declared quantity
 * `performShot` already treats as authoritative everywhere else: its `spanOf`
 * gates action overlap and covers blocking anchors with exactly this number, so
 * the compiled clip and the gates were reading two different timelines.
 *
 * The geometry is countable by hand: a 1 s gait cycle at 1 m/s covers one metre
 * per stride, and the destination is three metres straight ahead, so the
 * engine's own sizing is three whole cycles and 3.0 s. Every expectation below
 * is that arithmetic, never a value read back from the synthesiser.
 *
 * Scenarios:
 *
 * 1. The reproduction: `start: 2.5`, `duration: 7.5`, a target 3.0 s away at the
 *    gait's speed. The clip spans 7.5 s and the compiled performance ends at
 *    10.0 s, where it used to end at 5.5 s (2.5 + the substituted 3.0).
 * 2. The fit changes the cadence, NOT the path: the declared walk arrives at the
 *    same three metres the auto walk arrives at, and its `gaitCycle.period`
 *    scales with the clip (1 s → 2.5 s) so the recorded stride phase a later
 *    beat resumes from stays honest.
 * 3. `"auto"` keeps its meaning exactly: the same action sized by the engine still
 *    compiles the natural 3.0 s of three whole cycles.
 * 4. A quicker span works the same way in the other direction (1.5 s, half the
 *    natural), so the fit is not a one-sided "extend".
 * 5. The boundary: a declared duration equal to the natural one is a no-op, which
 *    is what makes the fit a scale rather than a rewrite.
 * 6. The step-in-place arms take the span too: a relative target (no resolvable
 *    point) and a destination the actor already stands on both honour an
 *    explicit duration, and both keep the single natural cycle under `"auto"`.
 */
export const test_perform_locomote_declared_duration = (): void => {
  // 1. the reproduction.
  const declared = synth(walkTo(7.5, 2.5), "hero")!;
  TestValidator.predicate(
    "an explicit duration is the clip's span",
    nclose(declared.duration, 7.5),
  );
  const compiled = compilePerformance([walkTo(7.5, 2.5)], synth).performances
    .hero!;
  TestValidator.predicate(
    "the compiled performance ends at start + the declared duration",
    nclose(compiled.duration, 10),
  );

  // 2. same path, same arrival, different cadence.
  const auto = synth(walkTo("auto"), "hero")!;
  TestValidator.predicate(
    "fitting the span does not move where the walk arrives",
    nclose(arrival(declared), 3) && nclose(arrival(auto), 3),
  );
  TestValidator.predicate(
    "the gait cycle scales with the clip, so the stride phase stays honest",
    nclose(auto.gaitCycle!.period, 1) &&
      nclose(declared.gaitCycle!.period, 2.5),
  );

  // 3. "auto" is untouched: the engine's own sizing, three whole cycles.
  TestValidator.predicate(
    "an auto duration still compiles the natural walk",
    nclose(auto.duration, 3),
  );

  // 4. the other direction: a span shorter than the natural one.
  const quick = synth(walkTo(1.5), "hero")!;
  TestValidator.predicate(
    "a shorter declared span compresses the same walk",
    nclose(quick.duration, 1.5) &&
      nclose(arrival(quick), 3) &&
      nclose(quick.gaitCycle!.period, 0.5),
  );

  // 5. the boundary: declaring exactly the natural duration changes nothing.
  TestValidator.equals(
    "declaring the natural duration is a no-op",
    synth(walkTo(3), "hero"),
    auto,
  );

  // 6. the step-in-place arms honour the span as well.
  const stepping = synth(stepInPlace(4), "hero")!;
  TestValidator.predicate(
    "a relative target steps in place for the declared span",
    nclose(stepping.duration, 4) &&
      nclose(synth(stepInPlace("auto"), "hero")!.duration, 1),
  );
  const standingStill: IAutoMovieActionCall = {
    verb: "locomote",
    actor: "hero",
    gait: "walk",
    to: { kind: "point", point: HERO.position },
    start: 0,
    duration: 4,
  };
  TestValidator.predicate(
    "a destination the actor already stands on honours the span too",
    nclose(synth(standingStill, "hero")!.duration, 4) &&
      nclose(
        synth({ ...standingStill, duration: "auto" }, "hero")!.duration,
        1,
      ),
  );
};
