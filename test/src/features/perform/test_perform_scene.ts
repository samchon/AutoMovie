import {
  IAutoMovieActorContext,
  compilePerformance,
  makeActorSynthesizer,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieGait,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const actorAt = (
  skeleton: string,
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieActorContext => ({
  skeleton,
  gaits: [WALK],
  position,
  speed: 1,
  facingDeg,
  eyeHeight: 1.6,
  restPose: makePose([joint("spine", { flexion: 0 })]),
});

const bonesOf = (motion: {
  keyframes: { pose: { joints: { bone: string }[] } }[];
}): Set<string> =>
  new Set(motion.keyframes.flatMap((k) => k.pose.joints.map((j) => j.bone)));

const hasExpression = (motion: {
  keyframes: { expression: unknown }[];
}): boolean => motion.keyframes.some((k) => k.expression !== null);

/**
 * End-to-end acceptance: a two-actor beat compiles through the **whole**
 * executable core, the reference synthesizer (gait travel, look-at, emote) and
 * the region-layering compiler, into one performance clip per actor.
 *
 * The beat: HERO walks over to GUARD while looking at her and smiling; GUARD
 * stands her ground, glaring back and scowling. So HERO layers three disjoint
 * regions (legs travel + head look + face) over a 5 m walk, and GUARD layers
 * two (head + face). This exercises multi-actor fan-out, per-region
 * concurrency, gait travel, and aim (composed, not in isolation).
 */
export const test_perform_scene = (): void => {
  const contexts = new Map<string, IAutoMovieActorContext>([
    ["hero", actorAt("hero-rig", { x: 0, y: 0, z: 0 }, 0)],
    ["guard", actorAt("guard-rig", { x: 0, y: 0, z: 5 }, 180)],
  ]);
  const nodes = new Map<string, IAutoMovieVector3>([
    ["hero", { x: 0, y: 0, z: 0 }],
    ["guard", { x: 0, y: 0, z: 5 }],
  ]);
  const synth = makeActorSynthesizer(contexts, nodes);

  const actions: IAutoMovieActionCall[] = [
    {
      verb: "locomote",
      gait: "walk",
      to: { kind: "node", node: "guard" },
      actor: "hero",
      start: 0,
      duration: "auto",
    },
    {
      verb: "lookAt",
      to: { kind: "node", node: "guard" },
      actor: "hero",
      start: 0,
      duration: 5,
    },
    {
      verb: "emote",
      preset: "happy",
      intensity: 0.9,
      actor: "hero",
      start: 0,
      duration: 5,
    },
    {
      verb: "lookAt",
      to: { kind: "node", node: "hero" },
      actor: "guard",
      start: 0,
      duration: 5,
    },
    {
      verb: "emote",
      preset: "angry",
      intensity: 0.8,
      actor: "guard",
      start: 0,
      duration: 5,
    },
  ];

  const perf = compilePerformance(actions, synth).performances;

  TestValidator.equals(
    "both actors are performed",
    Object.keys(perf).sort((a, b) => a.localeCompare(b)),
    ["guard", "hero"],
  );

  // HERO: legs (gait) + head (look-at) layered, with the smile carried
  const heroBones = bonesOf(perf.hero!);
  TestValidator.predicate(
    "hero layers the walking legs and the turned head at once",
    heroBones.has("leftUpperLeg") && heroBones.has("head"),
  );
  TestValidator.predicate(
    "hero carries an expression",
    hasExpression(perf.hero!),
  );
  TestValidator.predicate(
    "hero's walk carried it the full ~5 m (≈5 one-second cycles)",
    nclose(perf.hero!.duration, 5),
  );

  // GUARD: stands and glares, a turned head + a scowl, no travel
  const guardBones = bonesOf(perf.guard!);
  TestValidator.predicate("guard turns her head", guardBones.has("head"));
  TestValidator.predicate(
    "guard does not walk (no leg drive)",
    !guardBones.has("leftUpperLeg"),
  );
  TestValidator.predicate(
    "guard carries an expression",
    hasExpression(perf.guard!),
  );
};
