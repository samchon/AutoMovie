import {
  HORSE_GAITS,
  HORSE_PROFILE,
  bindProfileGaits,
  gaitMotion,
  validateMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieBone,
  IAutoMovieJointConstraint,
  IAutoMovieSkeleton,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const range = (min: number, max: number) => ({ min, max });
const con = (
  flexion: { min: number; max: number } | null,
  abduction: { min: number; max: number } | null,
  twist: { min: number; max: number } | null,
): IAutoMovieJointConstraint => ({ flexion, abduction, twist });

const legCon = con(range(-80, 90), range(-15, 25), range(-15, 15));
const kneeCon = con(range(-10, 150), null, null);

const HORSE_ROM: Partial<
  Record<AutoMovieHumanoidBone, IAutoMovieJointConstraint>
> = {
  spine: con(range(-45, 50), range(-20, 20), range(-25, 25)),
  chest: con(range(-35, 40), range(-15, 15), range(-20, 20)),
  neck: con(range(-70, 80), range(-40, 40), range(-40, 40)),
  head: con(range(-60, 60), range(-30, 30), range(-50, 50)),
  leftUpperArm: legCon,
  rightUpperArm: legCon,
  leftLowerArm: kneeCon,
  rightLowerArm: kneeCon,
  leftUpperLeg: legCon,
  rightUpperLeg: legCon,
  leftLowerLeg: kneeCon,
  rightLowerLeg: kneeCon,
};

const bone = (b: AutoMovieHumanoidBone): IAutoMovieBone => ({
  bone: b,
  parent: null,
  rest: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  constraint: HORSE_ROM[b] ?? null,
});

const RIG: IAutoMovieSkeleton = {
  id: "horse",
  bones: [
    "hips",
    "spine",
    "chest",
    "neck",
    "head",
    "leftUpperArm",
    "rightUpperArm",
    "leftLowerArm",
    "rightLowerArm",
    "leftUpperLeg",
    "rightUpperLeg",
    "leftLowerLeg",
    "rightLowerLeg",
  ].map((b) => bone(b as AutoMovieHumanoidBone)),
};

const NAMES = ["walk", "trot", "gallop", "rear"] as const;

const limbOf = (
  gait: (typeof HORSE_GAITS)[keyof typeof HORSE_GAITS],
  b: AutoMovieHumanoidBone,
) => gait.limbs.find((l) => l.bone === b)!;

const minimumFlexion = (
  gait: (typeof HORSE_GAITS)[keyof typeof HORSE_GAITS],
  b: AutoMovieHumanoidBone,
): number => {
  const limb = limbOf(gait, b);
  return (limb.neutral ?? 0) - limb.amplitude;
};

/**
 * The canonical horse gait library: the playground mount's core movement names
 * as reusable Profile data. This locks the data fixture before the visual
 * playground clips are replaced or compared frame by frame.
 *
 * Scenarios:
 *
 * 1. The fixture exposes walk/trot/gallop/rear under their stable names and keeps
 *    the periods inherited from the playground clips.
 * 2. Every gait synthesises into a concrete clip and validates against the horse
 *    ROM: leg rows stay in quadruped raw rig-space, not humanoid clinical
 *    rest-frame space.
 * 3. Movement energy is ordered by intent: walk < trot < gallop in stride
 *    amplitude and period, while rear pitches the spine and front legs far
 *    beyond locomotion.
 * 4. The horse profile carries the same names and binds each gait to
 *    profile-scoped clip ids.
 */
export const test_motion_horse_gaits = (): void => {
  TestValidator.equals(
    "all horse movement names present",
    Object.keys(HORSE_GAITS).sort((a, b) => a.localeCompare(b)),
    [...NAMES].sort((a, b) => a.localeCompare(b)),
  );
  for (const name of NAMES)
    TestValidator.equals(
      `${name} stamps its name`,
      HORSE_GAITS[name].name,
      name,
    );

  TestValidator.predicate(
    "walk keeps playground period",
    nclose(HORSE_GAITS.walk.period, 1),
  );
  TestValidator.predicate(
    "trot keeps playground period",
    nclose(HORSE_GAITS.trot.period, 0.72),
  );
  TestValidator.predicate(
    "gallop keeps playground period",
    nclose(HORSE_GAITS.gallop.period, 0.6),
  );
  TestValidator.predicate(
    "rear keeps playground period",
    nclose(HORSE_GAITS.rear.period, 2.6),
  );

  for (const name of NAMES) {
    const clip = gaitMotion(name, RIG.id, HORSE_GAITS[name], 24);
    TestValidator.equals(
      `${name} stays inside horse ROM`,
      validateMotion({ motion: clip, skeleton: RIG }).success,
      true,
    );
  }

  TestValidator.predicate(
    "stride grows walk < trot < gallop",
    limbOf(HORSE_GAITS.walk, "leftUpperArm").amplitude <
      limbOf(HORSE_GAITS.trot, "leftUpperArm").amplitude &&
      limbOf(HORSE_GAITS.trot, "leftUpperArm").amplitude <
        limbOf(HORSE_GAITS.gallop, "leftUpperArm").amplitude,
  );
  TestValidator.predicate(
    "faster horse gaits have shorter periods",
    HORSE_GAITS.walk.period > HORSE_GAITS.trot.period &&
      HORSE_GAITS.trot.period > HORSE_GAITS.gallop.period,
  );
  TestValidator.predicate(
    "rear lifts front and pitches spine beyond locomotion",
    minimumFlexion(HORSE_GAITS.rear, "leftUpperArm") < -70 &&
      minimumFlexion(HORSE_GAITS.rear, "spine") <
        minimumFlexion(HORSE_GAITS.gallop, "spine"),
  );

  const bound = bindProfileGaits(HORSE_PROFILE, RIG.id, 24);
  TestValidator.equals(
    "horse profile carries all gait names",
    HORSE_PROFILE.gaits!.map((g) => g.name).sort((a, b) => a.localeCompare(b)),
    [...NAMES].sort((a, b) => a.localeCompare(b)),
  );
  TestValidator.equals(
    "horse profile binds every gait",
    Object.keys(bound).sort((a, b) => a.localeCompare(b)),
    [...NAMES].sort((a, b) => a.localeCompare(b)),
  );
  TestValidator.equals(
    "profile-bound gallop has a profile-scoped id",
    bound.gallop!.id,
    "horse:gallop",
  );
  for (const name of NAMES)
    TestValidator.equals(
      `profile-bound ${name} stays inside horse ROM`,
      validateMotion({ motion: bound[name], skeleton: RIG }).success,
      true,
    );
};
