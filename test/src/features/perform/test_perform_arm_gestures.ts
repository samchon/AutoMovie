import {
  HUMANOID_JOINT_AXES,
  IAutoFilmActorContext,
  makeActorSynthesizer,
  resolvePose,
  sampleMotion,
} from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmBone,
  IAutoFilmGestureAction,
  IAutoFilmSkeleton,
  IAutoFilmVector3,
} from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, makePose } from "../internal/fixtures";

const bone = (
  b: AutoFilmHumanoidBone,
  parent: AutoFilmHumanoidBone | null,
  t: IAutoFilmVector3,
): IAutoFilmBone => ({
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
const RIG: IAutoFilmSkeleton = {
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

const ctx: IAutoFilmActorContext = {
  skeleton: RIG.id,
  gaits: [],
  position: { x: 0, y: 0, z: 0 },
  speed: 1,
  facingDeg: 0,
  eyeHeight: 1.6,
  restPose: makePose([]),
  rig: RIG,
};

const nodes = new Map<string, IAutoFilmVector3>([
  ["exit", { x: 3, y: 1.2, z: 1 }], // far — a point extends the arm toward it
]);

const gesture = (
  kind: IAutoFilmGestureAction["kind"],
  overrides: Partial<IAutoFilmGestureAction> = {},
): IAutoFilmGestureAction => ({
  verb: "gesture",
  actor: "hero",
  start: 0,
  duration: 1,
  kind,
  ...overrides,
});

const boneWorld = (
  pose: ReturnType<typeof sampleMotion>["pose"],
  b: AutoFilmHumanoidBone,
): IAutoFilmVector3 =>
  resolvePose(pose, RIG, HUMANOID_JOINT_AXES).find((x) => x.bone === b)!
    .worldPosition;

/**
 * `point` — the arm gesture the synthesiser rides `reachPose` for: an arm
 * extended toward the `at` target (reachPose clamps a far target onto the reach
 * shell, which is exactly a pointing arm). Left unclamped like `reach`, so an
 * impossible point fails the shot's ROM gate rather than the engine faking it.
 *
 * Scenarios:
 *
 * 1. `point at: exit` extends the right arm toward the far target: the right hand
 *    ends up markedly further along the shoulder→target direction than at rest,
 *    and the clip is a rest → extend → hold.
 * 2. `point` with no `at`, a rig-less context, and an unhandled arm/combat kind
 *    (`draw`) all synthesise nothing.
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
    "an unhandled arm gesture (draw) → null",
    synth(gesture("draw"), "hero"),
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
};
