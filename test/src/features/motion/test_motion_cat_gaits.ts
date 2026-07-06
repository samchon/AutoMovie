import {
  CAT_GAITS,
  CAT_PROFILE,
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

const legCon = con(range(-70, 80), range(-20, 35), range(-20, 20));
const kneeCon = con(range(0, 150), null, null);
const tailCon = con(range(-80, 80), range(-50, 50), null);

const CAT_ROM: Partial<
  Record<AutoMovieHumanoidBone, IAutoMovieJointConstraint>
> = {
  spine: con(range(-40, 55), range(-25, 25), range(-30, 30)),
  chest: con(range(-30, 45), range(-20, 20), range(-25, 25)),
  neck: con(range(-60, 70), range(-45, 45), range(-60, 60)),
  head: con(range(-50, 60), range(-45, 45), range(-70, 70)),
  leftUpperArm: legCon,
  rightUpperArm: legCon,
  leftLowerArm: kneeCon,
  rightLowerArm: kneeCon,
  leftUpperLeg: legCon,
  rightUpperLeg: legCon,
  leftLowerLeg: kneeCon,
  rightLowerLeg: kneeCon,
  leftLittleProximal: tailCon,
  leftLittleIntermediate: tailCon,
  leftLittleDistal: tailCon,
};

const bone = (b: AutoMovieHumanoidBone): IAutoMovieBone => ({
  bone: b,
  parent: null,
  rest: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  constraint: CAT_ROM[b] ?? null,
});

const RIG: IAutoMovieSkeleton = {
  id: "cat",
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
    "leftLittleProximal",
    "leftLittleIntermediate",
    "leftLittleDistal",
  ].map((b) => bone(b as AutoMovieHumanoidBone)),
};

const NAMES = ["walk", "leap", "stalk"] as const;

const limbOf = (
  gait: (typeof CAT_GAITS)[keyof typeof CAT_GAITS],
  b: AutoMovieHumanoidBone,
) => gait.limbs.find((l) => l.bone === b && l.axis === undefined)!;

/**
 * The canonical cat gait library: walk/leap/stalk as Profile data, pinned
 * before the playground clips are visually replaced. The test keeps the cat in
 * quadruped raw rig-space and proves all generated clips fit cat ROM.
 *
 * Scenarios:
 *
 * 1. The fixture exposes walk/leap/stalk under their stable names and keeps the
 *    walk/leap periods inherited from the playground clips.
 * 2. Every gait synthesises into a concrete clip and validates against cat ROM,
 *    including tail rows on the repurposed finger chain.
 * 3. Walk keeps the diagonal-pair phase pattern; leap is springier and taller than
 *    walking; stalk is slower and lower than walking.
 * 4. The cat profile carries the same names and binds each gait to profile-scoped
 *    clip ids.
 */
export const test_motion_cat_gaits = (): void => {
  TestValidator.equals(
    "all cat movement names present",
    Object.keys(CAT_GAITS).sort((a, b) => a.localeCompare(b)),
    [...NAMES].sort((a, b) => a.localeCompare(b)),
  );
  for (const name of NAMES)
    TestValidator.equals(`${name} stamps its name`, CAT_GAITS[name].name, name);

  TestValidator.predicate(
    "walk keeps playground period",
    nclose(CAT_GAITS.walk.period, 0.8),
  );
  TestValidator.predicate(
    "leap keeps playground period",
    nclose(CAT_GAITS.leap.period, 1),
  );
  TestValidator.predicate(
    "stalk uses a slower prowl period",
    nclose(CAT_GAITS.stalk.period, 1.2),
  );

  for (const name of NAMES) {
    const clip = gaitMotion(name, RIG.id, CAT_GAITS[name], 24);
    TestValidator.equals(
      `${name} stays inside cat ROM`,
      validateMotion({ motion: clip, skeleton: RIG }).success,
      true,
    );
  }

  TestValidator.equals(
    "walk phases front-left with hind-right",
    limbOf(CAT_GAITS.walk, "leftUpperArm").phase,
    limbOf(CAT_GAITS.walk, "rightUpperLeg").phase,
  );
  TestValidator.equals(
    "walk phases front-right with hind-left",
    limbOf(CAT_GAITS.walk, "rightUpperArm").phase,
    limbOf(CAT_GAITS.walk, "leftUpperLeg").phase,
  );
  TestValidator.predicate(
    "leap is springier and taller than walk",
    CAT_GAITS.leap.style!.springiness! > CAT_GAITS.walk.style!.springiness! &&
      CAT_GAITS.leap.rootBob!.amplitude > CAT_GAITS.walk.rootBob!.amplitude,
  );
  TestValidator.predicate(
    "stalk is slower and lower than walk",
    CAT_GAITS.stalk.period > CAT_GAITS.walk.period &&
      CAT_GAITS.stalk.rootBob!.center < CAT_GAITS.walk.rootBob!.center,
  );

  const bound = bindProfileGaits(CAT_PROFILE, RIG.id, 24);
  TestValidator.equals(
    "cat profile carries all gait names",
    CAT_PROFILE.gaits!.map((g) => g.name).sort((a, b) => a.localeCompare(b)),
    [...NAMES].sort((a, b) => a.localeCompare(b)),
  );
  TestValidator.equals(
    "cat profile binds every gait",
    Object.keys(bound).sort((a, b) => a.localeCompare(b)),
    [...NAMES].sort((a, b) => a.localeCompare(b)),
  );
  TestValidator.equals(
    "profile-bound stalk has a profile-scoped id",
    bound.stalk!.id,
    "cat:stalk",
  );
  for (const name of NAMES)
    TestValidator.equals(
      `profile-bound ${name} stays inside cat ROM`,
      validateMotion({ motion: bound[name], skeleton: RIG }).success,
      true,
    );
};
