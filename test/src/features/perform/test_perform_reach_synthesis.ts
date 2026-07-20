import {
  HUMANOID_JOINT_AXES,
  IAutoMovieActorContext,
  makeActorSynthesizer,
  resolvePose,
  sampleMotion,
} from "@automovie/engine";
import { IAutoMovieReachAction, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, makePose } from "../internal/fixtures";
import { nclose, vclose } from "../internal/predicates";

const ctx = (facingDeg: number): IAutoMovieActorContext => ({
  skeleton: "skeleton-1",
  gaits: [],
  position: { x: 1, y: 0, z: 2 }, // placed away from the origin
  speed: 1,
  facingDeg,
  eyeHeight: 1.6,
  restPose: makePose([]),
  rig: createSkeleton(),
});

// Each lever is placed so its model-space image (after undoing the actor's
// facing) sits inside the 0.55 m arm reach for that facing: a fixed world
// point maps to a different arm distance as the actor turns.
const nodes = new Map<string, IAutoMovieVector3>([
  ["lever", { x: 1.35, y: 1.2, z: 2.25 }], // reachable facing 0
  ["lever90", { x: 1.2, y: 1.3, z: 1.7 }], // reachable facing 90
]);

const reach = (
  overrides: Partial<IAutoMovieReachAction> = {},
): IAutoMovieReachAction => ({
  verb: "reach",
  actor: "hero",
  start: 0,
  duration: 0.6,
  hand: "left",
  to: { kind: "node", node: "lever" },
  ...overrides,
});

/** The left hand's world position, given the pose sampled in model space. */
const worldHand = (
  pose: ReturnType<typeof sampleMotion>["pose"],
  facingDeg: number,
  position: IAutoMovieVector3,
): IAutoMovieVector3 => {
  const model = resolvePose(pose, createSkeleton(), HUMANOID_JOINT_AXES).find(
    (b) => b.bone === "leftHand",
  )!.worldPosition;
  const f = (facingDeg * Math.PI) / 180;
  const cos = Math.cos(f);
  const sin = Math.sin(f);
  // model → world: rotate by +facing about Y, then translate by position
  return {
    x: position.x + (model.x * cos + model.z * sin),
    y: position.y + model.y,
    z: position.z + (-model.x * sin + model.z * cos),
  };
};

/**
 * The reference synthesiser fattening the `reach` verb through `reachPose`. The
 * contract carries end to end: resolve the target, drop it into the actor's
 * model space, solve the arm, and at the held instant the actor's hand, placed
 * back in the world, lands on the world target. Facing must be undone correctly
 * for a placed, turned actor.
 *
 * Scenarios:
 *
 * 1. A facing-0 actor reaching a world node → a rest → extend → hold clip whose
 *    held pose puts the world hand on the lever; the clip is not looped and
 *    lasts the duration.
 * 2. A facing-90 actor reaching the same node still lands the hand on it: the
 *    world→model facing transform is inverted correctly.
 * 3. A rig-less context and a relative (direction) target both synthesise nothing.
 */
export const test_perform_reach_synthesis = (): void => {
  const lever = nodes.get("lever")!;

  const s0 = makeActorSynthesizer(new Map([["hero", ctx(0)]]), nodes);
  const clip = s0(reach(), "hero");
  TestValidator.predicate("reach produced a clip", clip !== null);
  if (clip === null) return;
  TestValidator.equals("rest → extend → hold", clip.keyframes.length, 3);
  TestValidator.equals("not looped", clip.loop, false);
  TestValidator.predicate("lasts the duration", nclose(clip.duration, 0.6));
  TestValidator.predicate(
    "the held hand lands on the world target (facing 0)",
    vclose(
      worldHand(sampleMotion(clip, 0.6).pose, 0, { x: 1, y: 0, z: 2 }),
      lever,
      2e-3,
    ),
  );

  const lever90 = nodes.get("lever90")!;
  const s90 = makeActorSynthesizer(new Map([["hero", ctx(90)]]), nodes);
  const turned = s90(reach({ to: { kind: "node", node: "lever90" } }), "hero")!;
  TestValidator.predicate(
    "the held hand lands on the world target (facing 90)",
    vclose(
      worldHand(sampleMotion(turned, 0.6).pose, 90, { x: 1, y: 0, z: 2 }),
      lever90,
      2e-3,
    ),
  );

  const rigless = makeActorSynthesizer(
    new Map([["hero", { ...ctx(0), rig: undefined }]]),
    nodes,
  );
  TestValidator.equals("no rig, no reach", rigless(reach(), "hero"), null);
  TestValidator.equals(
    "a relative reach target → null",
    s0(reach({ to: { kind: "direction", headingDeg: 45 } }), "hero"),
    null,
  );
  TestValidator.equals(
    "a reach with no arm chain (right, no rightHand) → null",
    s0(reach({ hand: "right" }), "hero"),
    null,
  );
  const auto = s0(reach({ duration: "auto" }), "hero");
  TestValidator.predicate(
    "an auto-duration reach runs the default 0.6 s",
    auto !== null && nclose(auto.duration, 0.6),
  );
};
