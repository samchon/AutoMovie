import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  IAutoMovieActorContext,
  makeActorSynthesizer,
  resolveBoneTarget,
  resolvePose,
  sampleMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieActionTarget,
  IAutoMovieBone,
  IAutoMovieGestureAction,
  IAutoMovieJointPose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const bone = (
  b: AutoMovieHumanoidBone,
  parent: AutoMovieHumanoidBone | null,
  t: IAutoMovieVector3,
): IAutoMovieBone => ({
  bone: b,
  parent,
  rest: {
    translation: t,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  constraint: null,
});

// A rig with BOTH arms complete (the shared fixture omits the right hand),
// so celebrate and a right-handed point have a full chain to solve.
const RIG: IAutoMovieSkeleton = {
  id: "twoArms",
  bones: [
    bone("hips", null, { x: 0, y: 1, z: 0 }),
    bone("spine", "hips", { x: 0, y: 0.2, z: 0 }),
    bone("chest", "spine", { x: 0, y: 0.2, z: 0 }),
    bone("leftUpperArm", "chest", { x: 0.2, y: 0, z: 0 }),
    bone("leftLowerArm", "leftUpperArm", { x: 0.3, y: 0, z: 0 }),
    bone("leftHand", "leftLowerArm", { x: 0.25, y: 0, z: 0 }),
    bone("rightUpperArm", "chest", { x: -0.2, y: 0, z: 0 }),
    bone("rightLowerArm", "rightUpperArm", { x: -0.3, y: 0, z: 0 }),
    bone("rightHand", "rightLowerArm", { x: -0.25, y: 0, z: 0 }),
  ],
};

const ctx: IAutoMovieActorContext = {
  skeleton: RIG.id,
  gaits: [],
  position: { x: 0, y: 0, z: 0 },
  speed: 1,
  facingDeg: 0,
  eyeHeight: 1.6,
  restPose: makePose([]),
  rig: RIG,
};

const nodes = new Map<string, IAutoMovieVector3>([
  ["exit", { x: 3, y: 1.2, z: 1 }], // far: a point extends the arm toward it
]);

const gesture = (
  kind: IAutoMovieGestureAction["kind"],
  overrides: Partial<IAutoMovieGestureAction> = {},
): IAutoMovieGestureAction => ({
  verb: "gesture",
  actor: "hero",
  start: 0,
  duration: 1,
  kind,
  ...overrides,
});

const boneWorld = (
  pose: ReturnType<typeof sampleMotion>["pose"],
  b: AutoMovieHumanoidBone,
): IAutoMovieVector3 =>
  resolvePose(pose, RIG, HUMANOID_JOINT_AXES).find((x) => x.bone === b)!
    .worldPosition;

/**
 * The reachPose arm gestures the synthesiser rides: `point` (an arm extended
 * toward the `at` target and held) and `strike` (a jab thrown at `at`, then
 * retracted). Both drop the world target into model space and solve the arm
 * unclamped like `reach`, so an impossible reach fails the shot's ROM gate
 * rather than the engine faking it.
 *
 * Scenarios:
 *
 * 1. `point at: exit` extends the right arm toward the far target: the right hand
 *    ends up markedly further along the shoulder→target direction than at rest,
 *    and the clip is a rest → extend → hold.
 * 2. `strike at: exit` snaps the right fist toward the target (a jab) and retracts
 *    it: rest → strike → rest.
 * 3. `point`/`strike` with no `at`, a rig-less context, and an unhandled combat
 *    kind (`draw`) all synthesise nothing.
 * 4. The context's rest frames decide the space the IK verbs answer in, and an
 *    omitted table takes the clinical default (#1346), so an ordinary context's
 *    `point` agrees with the explicit clinical solve digit for digit. The
 *    rig-space solve is a DIFFERENT legal pose rather than the same one
 *    renamed, because the solver elects its swivel by ROM legality judged in
 *    the declared space (#1345); the elbow's hinge angle, set by the target
 *    distance alone, is identical across both.
 * 5. A bone target's FK point carries its pose-root travel once, then its staged
 *    actor position once; it never doubles locomotion.
 */
export const test_perform_arm_gestures = (): void => {
  const synth = makeActorSynthesizer(new Map([["hero", ctx]]), nodes);

  const point = synth(
    gesture("point", { at: { kind: "node", node: "exit" } }),
    "hero",
  );
  TestValidator.predicate("point produced a clip", point !== null);
  if (point === null) return;
  TestValidator.equals("rest → extend → hold", point.keyframes.length, 3);
  const restHand = boneWorld(sampleMotion(point, 0).pose, "rightHand");
  const pointedHand = boneWorld(sampleMotion(point, 1).pose, "rightHand");
  TestValidator.predicate(
    "the right hand extends toward the target (+x)",
    pointedHand.x > restHand.x + 0.1,
  );

  // strike at the target: a jab; the right fist snaps toward it, then retracts.
  const strike = synth(
    gesture("strike", { at: { kind: "node", node: "exit" } }),
    "hero",
  );
  TestValidator.predicate("strike produces a jab clip", strike !== null);
  if (strike !== null) {
    TestValidator.equals(
      "rest → strike → rest (a jab)",
      strike.keyframes.length,
      3,
    );
    const restFist = boneWorld(sampleMotion(strike, 0).pose, "rightHand");
    const peakFist = boneWorld(
      sampleMotion(strike, strike.duration * 0.4).pose,
      "rightHand",
    );
    const endFist = boneWorld(
      sampleMotion(strike, strike.duration).pose,
      "rightHand",
    );
    TestValidator.predicate(
      "the fist snaps toward the target (+x)",
      peakFist.x > restFist.x + 0.1,
    );
    TestValidator.predicate(
      "and retracts to rest by the end",
      nclose(endFist.x, restFist.x, 1e-6),
    );
  }
  TestValidator.equals(
    "strike with nothing to hit → null",
    synth(gesture("strike"), "hero"),
    null,
  );

  TestValidator.equals(
    "point with nothing to point at → null",
    synth(gesture("point"), "hero"),
    null,
  );
  const rigless = makeActorSynthesizer(
    new Map([["hero", { ...ctx, rig: undefined }]]),
    nodes,
  );
  TestValidator.equals(
    "point with no rig → null",
    rigless(gesture("point", { at: { kind: "node", node: "exit" } }), "hero"),
    null,
  );
  TestValidator.equals(
    "an unhandled arm gesture (guard) → null",
    synth(gesture("guard"), "hero"),
    null,
  );
  const disappearingBone: IAutoMovieActionTarget = {
    kind: "bone",
    node: "movingTarget",
    bone: "leftHand",
  };
  TestValidator.equals(
    "the bone resolver ignores a non-bone target",
    resolveBoneTarget(
      { kind: "node", node: "exit" },
      new Map([["hero", ctx]]),
      undefined,
      0,
    ),
    null,
  );
  TestValidator.equals(
    "the bone resolver refuses a target actor with no rig",
    resolveBoneTarget(
      { ...disappearingBone, node: "rigless" },
      new Map([["rigless", { ...ctx, rig: undefined }]]),
      undefined,
      0,
    ),
    null,
  );
  const rootedTarget = resolveBoneTarget(
    disappearingBone,
    new Map([
      [
        "movingTarget",
        {
          ...ctx,
          position: { x: 4, y: 0, z: 0 },
          restPose: makePose([], {
            translation: { x: 2, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          }),
        },
      ],
    ]),
    undefined,
    0,
  );
  TestValidator.predicate(
    "a bone target applies its FK root travel exactly once",
    rootedTarget !== null &&
      nclose(rootedTarget.x, 6.75) &&
      nclose(rootedTarget.y, 1.4),
  );
  const dynamicThenMissing = makeActorSynthesizer(
    new Map([["hero", ctx]]),
    nodes,
    (_target, seconds) => (seconds === 0 ? nodes.get("exit")! : null),
  );
  TestValidator.equals(
    "a bone point refuses rather than holding a target that disappears mid-span",
    dynamicThenMissing(gesture("point", { at: disappearingBone }), "hero"),
    null,
  );
  TestValidator.equals(
    "a bone strike refuses rather than holding a target that disappears mid-span",
    dynamicThenMissing(gesture("strike", { at: disappearingBone }), "hero"),
    null,
  );
  TestValidator.equals(
    "a bone reach refuses rather than holding a target that disappears mid-span",
    dynamicThenMissing(
      {
        verb: "reach",
        actor: "hero",
        start: 0,
        duration: 1,
        hand: "right",
        to: disappearingBone,
      },
      "hero",
    ),
    null,
  );
  // a rig whose right arm is incomplete cannot point (reachPose returns null)
  const noRightArm = makeActorSynthesizer(
    new Map([["hero", { ...ctx, rig: createSkeleton() }]]), // fixture omits rightHand
    nodes,
  );
  TestValidator.equals(
    "point with no right-arm chain → null",
    noRightArm(
      gesture("point", { at: { kind: "node", node: "exit" } }),
      "hero",
    ),
    null,
  );
  TestValidator.equals(
    "strike with no right-arm chain → null",
    noRightArm(
      gesture("strike", { at: { kind: "node", node: "exit" } }),
      "hero",
    ),
    null,
  );

  // The actor context's rest frames decide the space the point solve answers
  // in. The rig-space side is asked for EXPLICITLY with an empty table, because
  // a context that simply omits `restFrames` now takes the clinical default
  // (#1346).
  //
  // The two are NOT `90 − rig` apart, and expecting that was this case's old
  // premise. Since #1345 every swivel angle around the shoulder-to-hand axis is
  // an exact solution, so the solver spends that freedom on ROM legality, and
  // ROM is judged in whichever space the context declared. A different space
  // therefore elects a different legal pose, not a renaming of one. What the
  // frame cannot move is the elbow: its hinge angle follows from the
  // shoulder-to-target distance alone.
  const jointOf = (
    clip: ReturnType<typeof synth>,
    bone: AutoMovieHumanoidBone,
  ): IAutoMovieJointPose | null =>
    clip === null
      ? null
      : (clip.keyframes[clip.keyframes.length - 1]!.pose.joints.find(
          (j) => j.bone === bone,
        ) ?? null);
  const abdOf = (clip: ReturnType<typeof synth>): number | null =>
    jointOf(clip, "rightUpperArm")?.abduction ?? null;
  const clinical = makeActorSynthesizer(
    new Map([["hero", { ...ctx, restFrames: HUMANOID_REST_FRAME }]]),
    nodes,
  );
  const rigSpace = makeActorSynthesizer(
    new Map([["hero", { ...ctx, restFrames: {} }]]),
    nodes,
  );
  const pointAt = gesture("point", { at: { kind: "node", node: "exit" } });
  const rigClip = rigSpace(pointAt, "hero");
  const clinicalClip = clinical(pointAt, "hero");
  const clinAbd = abdOf(clinicalClip);
  TestValidator.predicate(
    "both frames synthesise a point clip, each in its own space",
    rigClip !== null && clinicalClip !== null && clinAbd !== null,
  );
  TestValidator.predicate(
    "and the elbow's hinge angle is identical across the two frames",
    nclose(
      jointOf(rigClip, "rightLowerArm")?.flexion ?? Number.NaN,
      jointOf(clinicalClip, "rightLowerArm")?.flexion ?? Number.NaN,
      1e-12,
    ),
  );
  // The frame the gate grades against is the one an ordinary context gets: a
  // `point` authored with no rest frames must agree with the explicit clinical
  // solve digit for digit, which is what stops `getReach` and `perform` from
  // describing one rig in two spaces.
  TestValidator.equals(
    "an actor context with no restFrames performs the CLINICAL point solve",
    abdOf(synth(pointAt, "hero")),
    clinAbd,
  );
};
