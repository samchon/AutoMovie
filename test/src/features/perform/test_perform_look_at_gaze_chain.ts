import {
  IAutoMovieActorContext,
  makeActorSynthesizer,
  validatePoseResult,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieActionCall,
  IAutoMovieAngleRange,
  IAutoMovieGait,
  IAutoMovieJointConstraint,
  IAutoMovieJointPose,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { namedFacts, nclose, violationCount } from "../internal/predicates";

/** The context needs gaits; no locomotion is exercised here. */
const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const range = (min: number, max: number): IAutoMovieAngleRange => ({
  min,
  max,
});

/** A cervical constraint: `lookAt` drives flexion and twist, never abduction. */
const cervical = (
  flexion: IAutoMovieAngleRange | null,
  twist: IAutoMovieAngleRange | null,
): IAutoMovieJointConstraint => ({ flexion, abduction: null, twist });

/** The gaze chain the S-06 run declared, the one the reproduction ran on. */
const S06: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointConstraint>> = {
  neck: cervical(range(-50, 60), range(-70, 70)),
  head: cervical(range(-30, 30), range(-30, 30)),
};

const rigWith = (
  constraints: Partial<
    Record<AutoMovieHumanoidBone, IAutoMovieJointConstraint>
  >,
  drop: AutoMovieHumanoidBone | null = null,
): IAutoMovieSkeleton => {
  const base = createSkeleton();
  return {
    ...base,
    bones: base.bones
      .filter((bone) => bone.bone !== drop)
      .map((bone) => ({
        ...bone,
        constraint: constraints[bone.bone] ?? bone.constraint,
      })),
  };
};

/** Eyes at 1.6 m, the height every geometry below is measured from. */
const EYE_HEIGHT = 1.6;

const contextOf = (rig: IAutoMovieSkeleton | null): IAutoMovieActorContext => ({
  skeleton: "skeleton-1",
  gaits: [WALK],
  position: { x: 0, y: 0, z: 0 },
  speed: 1,
  facingDeg: 0,
  eyeHeight: EYE_HEIGHT,
  restPose: makePose([joint("spine", { flexion: 0 })]),
  ...(rig === null ? {} : { rig }),
});

const NODES = new Map<string, IAutoMovieVector3>([
  ["hero", { x: 0, y: 0, z: 0 }],
]);

/** The pose one `lookAt` at an explicit point synthesises for this rig. */
const aim = (
  rig: IAutoMovieSkeleton | null,
  point: IAutoMovieVector3,
): IAutoMoviePose => {
  const action: IAutoMovieActionCall = {
    verb: "lookAt",
    to: { kind: "point", point },
    actor: "hero",
    start: 0,
    duration: 1,
  };
  const contexts = new Map<string, IAutoMovieActorContext>([
    ["hero", contextOf(rig)],
  ]);
  return makeActorSynthesizer(contexts, NODES)(action, "hero")!.keyframes[0]!
    .pose;
};

const boneOf = (
  pose: IAutoMoviePose,
  bone: AutoMovieHumanoidBone,
): IAutoMovieJointPose | undefined =>
  pose.joints.find((entry) => entry.bone === bone);

/** Degrees of flexion the aim formula demands: `+` is a downward tilt. */
const flexionFor = (dy: number, horizontal: number): number =>
  (-Math.atan2(dy, horizontal) * 180) / Math.PI;

/** Degrees of twist the aim formula demands for a target off to the side. */
const twistFor = (dx: number, dz: number): number =>
  (Math.atan2(dx, dz) * 180) / Math.PI;

/** One metre ahead and 1.1 m below eye level: 47.726…° of downward aim. */
const DESK: IAutoMovieVector3 = { x: 0, y: EYE_HEIGHT - 1.1, z: 1 };

/**
 * `lookAt` aims with the whole **gaze chain**, so a steep look compiles inside
 * the ROM the rig declares instead of piling the entire angle on one bone.
 *
 * The solver used to write the solved aim onto `head` alone, so two actors
 * looking down at a document emitted `head` flexion 47.726…° against a declared
 * `[-30, 30]`, while the `neck` the same `head` region owns sat at zero with
 * `[-50, 60]` to spare (#1360). The author cannot correct that by authoring
 * differently: the gaze angle is engine-solved from the target and the rig, so
 * the only recovery left was widening the head bone until one joint carried the
 * whole cervical range, which makes the rig lie about the body. This is #1345's
 * ROM-aware arm chain, one joint up.
 *
 * Every expected angle is computed from `atan2` on the stated geometry and
 * every split from the declared ranges; nothing is read back from the
 * synthesiser. `validatePoseResult` is the ROM oracle, the same gate
 * `performShot` runs the compiled clip through.
 *
 * Scenarios:
 *
 * 1. The reproduction: `atan2(1.1, 1) = 47.726…°` of downward aim on the S-06
 *    chain compiles with ZERO violations, `head` at its declared 30° maximum
 *    and `neck` carrying the remaining 17.726…°, and the two sum to exactly the
 *    angle the single-bone solve demanded, so the aim itself is unchanged.
 * 2. The negative twin: an aim the head holds on its own (16.699°) emits the
 *    single `head` joint it always did, with no `neck` in the pose at all, so
 *    the distribution is a strict extension rather than a new pose shape.
 * 3. The opposite hemisphere: an upward aim (−54.462°) splits by the same rule
 *    through the `min` side of both ranges, which a `Math.min`-only split would
 *    get backwards.
 * 4. The other axis: a 90° turn to the actor's left splits `twist` 30 + 60 while
 *    `flexion` stays 0 on the head and absent from the neck, so an axis that
 *    needs no help contributes no rotation.
 * 5. An IMMOBILE head twist (`null`, which `validateJointRom` reads as "must be
 *    null or 0") sends the whole 60° turn to the neck and leaves the head at
 *    exactly 0, which stays legal.
 * 6. A chain that genuinely cannot span the aim keeps failing UNCLAMPED, like a
 *    reach: with the neck narrowed to `[-10, 10]` the residual rides the head,
 *    so the gate reports one violation whose overshoot is exactly how far the
 *    whole declared chain falls short (47.726 − 40).
 * 7. A rig-less actor context keeps the single-bone aim byte for byte: there is no
 *    declared ROM to distribute against, and `performShot` runs no ROM gate on
 *    such an actor either.
 * 8. A rig that declares no `neck` bone also keeps the single-bone aim: naming a
 *    bone the skeleton does not carry would trade one violation for another.
 */
export const test_perform_look_at_gaze_chain = (): void => {
  // 1. the reproduction: the chain absorbs what the head alone could not.
  const rig = rigWith(S06);
  const steep = aim(rig, DESK);
  const required = flexionFor(-1.1, 1);
  TestValidator.predicate(
    "the reproduction's aim is the issue's 47.726 degrees",
    nclose(required, 47.726310993906274, 1e-9),
  );
  const head = boneOf(steep, "head")!;
  const neck = boneOf(steep, "neck")!;
  TestValidator.equals(
    "the head takes its declared maximum and the neck takes the rest",
    namedFacts([
      ["ncloseHeadFlexion", () => nclose(head.flexion!, 30)],
      [
        "ncloseNeckFlexion",
        () => nclose(head.flexion!, 30) && nclose(neck.flexion!, required - 30),
      ],
    ]),
    { ncloseHeadFlexion: true, ncloseNeckFlexion: true },
  );
  TestValidator.predicate(
    "the chain aims exactly where the single bone was aiming",
    nclose(head.flexion! + neck.flexion!, required),
  );
  TestValidator.equals(
    "the steep gaze breaks no declared range",
    violationCount(validatePoseResult(steep, rig)),
    0,
  );
  TestValidator.equals(
    "an axis the head holds alone leaves the neck silent",
    neck.twist,
    null,
  );

  // 2. the negative twin: an aim inside the head's own range is untouched.
  const shallow = aim(rig, { x: 0, y: EYE_HEIGHT - 0.3, z: 1 });
  TestValidator.equals(
    "a gaze the head can hold stays a single-joint pose",
    shallow.joints.map((entry) => entry.bone),
    ["head"],
  );
  TestValidator.equals(
    "that single joint carries the whole shallow aim",
    namedFacts([
      [
        "ncloseShallowJoints",
        () => nclose(shallow.joints[0]!.flexion!, flexionFor(-0.3, 1)),
      ],
      ["shallowJointsAbduction", () => shallow.joints[0]!.abduction === null],
      ["ncloseShallowJoints2", () => nclose(shallow.joints[0]!.twist!, 0)],
    ]),
    {
      ncloseShallowJoints: true,
      shallowJointsAbduction: true,
      ncloseShallowJoints2: true,
    },
  );

  // 3. the opposite hemisphere: an upward aim splits through the min side.
  const up = aim(rig, { x: 0, y: EYE_HEIGHT + 1.4, z: 1 });
  const upward = flexionFor(1.4, 1);
  TestValidator.equals(
    "an upward gaze splits at the head's minimum, not its maximum",
    namedFacts([
      ["ncloseBoneOfUp", () => nclose(boneOf(up, "head")!.flexion!, -30)],
      [
        "ncloseBoneOfUp2",
        () => nclose(boneOf(up, "neck")!.flexion!, upward + 30),
      ],
      ["upward", () => upward < -30],
    ]),
    { ncloseBoneOfUp: true, ncloseBoneOfUp2: true, upward: true },
  );
  TestValidator.equals(
    "the upward gaze breaks no declared range",
    violationCount(validatePoseResult(up, rig)),
    0,
  );

  // 4. the twist axis splits on the same rule, and flexion stays out of it.
  const turned = aim(rig, { x: 1, y: EYE_HEIGHT, z: 0 });
  TestValidator.equals(
    "a 90 degree turn splits twist 30 + 60 across the chain",
    namedFacts([
      ["ncloseTwistFor", () => nclose(twistFor(1, 0), 90)],
      ["ncloseBoneOfTurned", () => nclose(boneOf(turned, "head")!.twist!, 30)],
      ["ncloseBoneOfTurned2", () => nclose(boneOf(turned, "neck")!.twist!, 60)],
    ]),
    {
      ncloseTwistFor: true,
      ncloseBoneOfTurned: true,
      ncloseBoneOfTurned2: true,
    },
  );
  TestValidator.equals(
    "the axis that needed no help contributes nothing",
    namedFacts([
      ["ncloseBoneOfTurned", () => nclose(boneOf(turned, "head")!.flexion!, 0)],
      ["boneOfTurnedNeck", () => boneOf(turned, "neck")!.flexion === null],
      [
        "violationCountValidatePoseResultTurned",
        () => violationCount(validatePoseResult(turned, rig)) === 0,
      ],
    ]),
    {
      ncloseBoneOfTurned: true,
      boneOfTurnedNeck: true,
      violationCountValidatePoseResultTurned: true,
    },
  );

  // 5. an immobile head axis sends the whole turn to the neck.
  const immobile = rigWith({
    neck: cervical(range(-50, 60), range(-70, 70)),
    head: cervical(range(-30, 30), null),
  });
  const rolled = aim(immobile, { x: Math.sqrt(3), y: EYE_HEIGHT, z: 1 });
  TestValidator.equals(
    "an immobile head twist leaves the head at 0 and the neck at 60",
    namedFacts([
      ["ncloseTwistForMath", () => nclose(twistFor(Math.sqrt(3), 1), 60)],
      ["boneOfRolledHead", () => boneOf(rolled, "head")!.twist === 0],
      ["ncloseBoneOfRolled", () => nclose(boneOf(rolled, "neck")!.twist!, 60)],
      [
        "violationCountValidatePoseResultRolled",
        () => violationCount(validatePoseResult(rolled, immobile)) === 0,
      ],
    ]),
    {
      ncloseTwistForMath: true,
      boneOfRolledHead: true,
      ncloseBoneOfRolled: true,
      violationCountValidatePoseResultRolled: true,
    },
  );

  // 6. a chain that cannot span the aim fails unclamped, like a reach.
  const narrow = rigWith({
    neck: cervical(range(-10, 10), range(-70, 70)),
    head: cervical(range(-30, 30), range(-30, 30)),
  });
  const impossible = aim(narrow, DESK);
  const deficit = required - 40;
  TestValidator.equals(
    "what neither joint can take rides the head, unclamped",
    namedFacts([
      [
        "ncloseBoneOfImpossible",
        () => nclose(boneOf(impossible, "neck")!.flexion!, 10),
      ],
      [
        "ncloseBoneOfImpossible2",
        () => nclose(boneOf(impossible, "head")!.flexion!, 30 + deficit),
      ],
      ["deficit", () => deficit > 0],
    ]),
    {
      ncloseBoneOfImpossible: true,
      ncloseBoneOfImpossible2: true,
      deficit: true,
    },
  );
  TestValidator.equals(
    "the saturated chain still reports, once",
    violationCount(validatePoseResult(impossible, narrow)),
    1,
  );

  // 7. no rig, no distribution: the pose is what it always was.
  const rigless = aim(null, DESK);
  TestValidator.equals(
    "a rig-less context poses one bone",
    rigless.joints.map((entry) => entry.bone),
    ["head"],
  );
  TestValidator.equals(
    "a rig-less context keeps the whole angle on the head",
    namedFacts([
      [
        "ncloseRiglessJoints",
        () => nclose(rigless.joints[0]!.flexion!, required),
      ],
      ["riglessJointsAbduction", () => rigless.joints[0]!.abduction === null],
      ["ncloseRiglessJoints2", () => nclose(rigless.joints[0]!.twist!, 0)],
    ]),
    {
      ncloseRiglessJoints: true,
      riglessJointsAbduction: true,
      ncloseRiglessJoints2: true,
    },
  );

  // 8. a rig with no neck bone never names one.
  const neckless = rigWith({ head: S06.head! }, "neck");
  const posed = aim(neckless, DESK);
  TestValidator.equals(
    "a rig declaring no neck poses one bone",
    posed.joints.map((entry) => entry.bone),
    ["head"],
  );
  TestValidator.equals(
    "a rig declaring no neck keeps the single-bone aim",
    namedFacts([
      ["nclosePosedJoints", () => nclose(posed.joints[0]!.flexion!, required)],
      [
        "nclosePosedJoints2",
        () =>
          nclose(posed.joints[0]!.flexion!, required) &&
          nclose(posed.joints[0]!.twist!, 0),
      ],
    ]),
    { nclosePosedJoints: true, nclosePosedJoints2: true },
  );
};
