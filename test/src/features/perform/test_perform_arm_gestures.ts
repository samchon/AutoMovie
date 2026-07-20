import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  IAutoMovieActorContext,
  makeActorSynthesizer,
  resolvePose,
  sampleMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieBone,
  IAutoMovieGestureAction,
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
 * 4. Rest frames on the context lift the IK verbs into **clinical** space: the
 *    same point solve comes out with its arm abduction lifted by the frame
 *    (`rightUpperArm` sign −1, neutral 90 → clinical = 90 − rig), so a player
 *    reading through the same frames raises the arm correctly.
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

  // rest frames lift the same point solve into clinical space: the held pose's
  // right-upper-arm abduction comes out at 90 − rig (the frame's sign −1,
  // neutral 90), the value a matching player reads back up.
  const abdOf = (clip: ReturnType<typeof synth>): number | null =>
    clip === null
      ? null
      : (clip.keyframes[clip.keyframes.length - 1]!.pose.joints.find(
          (j) => j.bone === "rightUpperArm",
        )?.abduction ?? null);
  const clinical = makeActorSynthesizer(
    new Map([["hero", { ...ctx, restFrames: HUMANOID_REST_FRAME }]]),
    nodes,
  );
  const pointAt = gesture("point", { at: { kind: "node", node: "exit" } });
  const rigAbd = abdOf(synth(pointAt, "hero"));
  const clinAbd = abdOf(clinical(pointAt, "hero"));
  TestValidator.predicate(
    "rest frames lift the point's arm abduction to clinical (90 − rig)",
    rigAbd !== null && clinAbd !== null && nclose(clinAbd, 90 - rigAbd, 1e-6),
  );
};
