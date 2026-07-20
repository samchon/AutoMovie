import {
  IAutoMovieActorContext,
  compilePerformance,
  makeActorSynthesizer,
  resolveBeatEnd,
  sampleMotion,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieGait,
  IAutoMovieScene,
  IAutoMovieShot,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM, joint, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const ctx: IAutoMovieActorContext = {
  skeleton: "skeleton-1",
  gaits: [WALK],
  position: { x: 0, y: 0, z: 0 },
  speed: 1,
  facingDeg: 0,
  eyeHeight: 1.6,
  restPose: makePose([joint("spine", { flexion: 0 })]),
};

const contexts = new Map<string, IAutoMovieActorContext>([["hero", ctx]]);
const nodes = new Map<string, IAutoMovieVector3>([
  ["door", { x: 0, y: 0, z: 5 }],
]);

const locomote: IAutoMovieActionCall = {
  verb: "locomote",
  gait: "walk",
  to: { kind: "node", node: "door" },
  actor: "hero",
  start: 0,
  duration: "auto",
};

const lookAt: IAutoMovieActionCall = {
  verb: "lookAt",
  to: { kind: "node", node: "door" },
  actor: "hero",
  start: 0,
  duration: 1,
};

const gesture: IAutoMovieActionCall = {
  verb: "gesture",
  kind: "bow",
  actor: "hero",
  start: 0,
  duration: "auto",
};

const scene: IAutoMovieScene = {
  id: "scene",
  name: null,
  nodes: [
    {
      id: "hero",
      model: "hero",
      transform: IDENTITY_TRANSFORM,
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
};

const shotOf = (motionId: string, duration: number): IAutoMovieShot => ({
  id: "shot:beat-1",
  name: null,
  scene: "scene",
  camera: "cam",
  cameraMotion: null,
  performances: [{ node: "hero", motion: motionId, startOffset: 0 }],
  objectMotions: [],
  duration,
});

/**
 * The #650 proof: gaitPhase is ALIVE in the real performShot ladder. The
 * compiled performance is a non-looping arrange composite, which used to answer
 * null unconditionally. The carried {@link IAutoMovieGaitCycle} meta now flows
 * locomote → travel → arrange → compilePerformance, and resolveBeatEnd reads a
 * true stride phase off it.
 *
 * Scenarios:
 *
 * 1. A real locomote performance (walk to the door, 5 m at 1 m/s on a 1 s gait)
 *    compiled by the REAL synthesizer + compiler carries the cycle, and
 *    resolveBeatEnd at shot end 3.5 s returns phase 0.5: non-null through the
 *    actual ladder.
 * 2. The mid-stride resume invariant holds on the real path: the composite sampled
 *    at the shot end equals the source gait cycle sampled at the carried phase
 *    (leftUpperLeg flexion, grid-aligned time).
 * 3. A layered multi-region performance (locomote + lookAt) still carries the
 *    single striding region's clock through layerClips.
 * 4. A gesture-only performance carries no cycle: phase stays null (the honest
 *    one-shot answer, not a regression).
 */
export const test_film_gait_phase_pipeline = (): void => {
  const synthesize = makeActorSynthesizer(contexts, nodes);

  const walking = compilePerformance([locomote], synthesize);
  const hero = walking["hero"]!;
  TestValidator.equals(
    "the compiled composite carries the cycle",
    hero.gaitCycle,
    { period: 1, phaseAt: 0 },
  );

  const end = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(hero.id, 3.5),
    motions: [hero],
  });
  const heroEnd = end.actors.find((a) => a.node === "hero")!;
  TestValidator.predicate(
    "resolveBeatEnd reads a live stride phase off the real ladder",
    heroEnd.gaitPhase !== null && nclose(heroEnd.gaitPhase, 0.5),
  );

  const atEnd = sampleMotion(hero, 3.5).pose;
  const cycleClip = synthesize(locomote, "hero")!; // the travel composite
  const atPhase = sampleMotion(cycleClip, heroEnd.gaitPhase!).pose;
  const legAtEnd = atEnd.joints.find((j) => j.bone === "leftUpperLeg")!;
  const legAtPhase = atPhase.joints.find((j) => j.bone === "leftUpperLeg")!;
  TestValidator.predicate(
    "the carried phase re-samples to the same stride",
    nclose(legAtEnd.flexion ?? 0, legAtPhase.flexion ?? 0),
  );

  const layered = compilePerformance([locomote, lookAt], synthesize)["hero"]!;
  TestValidator.equals(
    "layered regions keep the single striding clock",
    layered.gaitCycle,
    { period: 1, phaseAt: 0 },
  );

  const gestureOnly = compilePerformance([gesture], synthesize)["hero"]!;
  const gestureEnd = resolveBeatEnd({
    beat: "beat-1",
    scene,
    shot: shotOf(gestureOnly.id, 0.5),
    motions: [gestureOnly],
  });
  TestValidator.equals(
    "a gesture-only performance stays phase-null",
    gestureEnd.actors.find((a) => a.node === "hero")!.gaitPhase,
    null,
  );
};
