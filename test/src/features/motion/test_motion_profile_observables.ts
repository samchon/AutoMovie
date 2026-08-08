import {
  CAT_PROFILE,
  HORSE_PROFILE,
  bindProfileGaits,
} from "@automovie/engine";
import { AutoMovieHumanoidBone, IAutoMovieMotion } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

interface NumericRange {
  min: number;
  max: number;
}

const rangeOf = (values: number[]): NumericRange => ({
  min: Math.min(...values),
  max: Math.max(...values),
});

const flexionRange = (
  motion: IAutoMovieMotion,
  bone: AutoMovieHumanoidBone,
): NumericRange =>
  rangeOf(
    motion.keyframes.map(
      (kf) => kf.pose.joints.find((j) => j.bone === bone)?.flexion ?? 0,
    ),
  );

const rootYRange = (motion: IAutoMovieMotion): NumericRange =>
  rangeOf(motion.keyframes.map((kf) => kf.pose.root?.translation.y ?? 0));

const coversRange = (
  actual: NumericRange,
  expected: NumericRange,
  tolerance: number,
): boolean =>
  actual.min <= expected.min + tolerance &&
  actual.max >= expected.max - tolerance;

const closesRange = (
  actual: NumericRange,
  expected: NumericRange,
  tolerance: number,
): boolean =>
  Math.abs(actual.min - expected.min) <= tolerance &&
  Math.abs(actual.max - expected.max) <= tolerance;

const horseHandAuthored = {
  walk: {
    duration: 1,
    leftUpperArm: { min: -16, max: 16 },
    leftLowerArm: { min: 8.8, max: 22 },
  },
  trot: {
    duration: 0.72,
    leftUpperArm: { min: -28, max: 28 },
    leftLowerArm: { min: 16, max: 40 },
    rootY: { min: 0.05, max: 0.09 },
  },
  gallop: {
    duration: 0.6,
    leftUpperArm: { min: -46, max: 46 },
    leftLowerArm: { min: 30, max: 74 },
    rootY: { min: 0.03, max: 0.16 },
  },
  rear: {
    duration: 2.6,
    leftUpperArm: { min: -78, max: -34 },
    leftLowerArm: { min: 66, max: 110 },
    spine: { min: -45, max: 8 },
  },
} as const;

const catHandAuthored = {
  walk: {
    duration: 0.8,
    leftUpperArm: { min: -24, max: 24 },
    leftLowerArm: { min: 14, max: 36 },
    leftUpperLeg: { min: -24, max: 24 },
    rightLowerLeg: { min: 18, max: 44 },
  },
  leap: {
    duration: 1,
    leftUpperArm: { min: -34, max: 0 },
    leftLowerArm: { min: 42, max: 52 },
    leftUpperLeg: { min: -38, max: 34 },
    leftLowerLeg: { min: 58, max: 92 },
    rootY: { min: -0.13, max: 0.24 },
  },
} as const;

/**
 * Profile-generated creature clips must preserve the key observables extracted
 * from the current handwritten playground TypeScript clips. This is the
 * migration lock before playground rendering starts consuming Profile output:
 * duration, limb ranges, and root-height ranges may be approximate, but they
 * must still cover the visible motion envelope of the source clips.
 *
 * Scenarios:
 *
 * 1. Horse Profile clips preserve handwritten walk/trot/gallop/rear durations and
 *    limb/root envelopes from `packages/playground/src/horse-motion.ts`.
 * 2. Cat Profile clips preserve handwritten walk/leap durations and limb/root
 *    envelopes from `packages/playground/src/cat-motion.ts`; stalk is new
 *    Profile data and is covered by its own fixture test.
 */
export const test_motion_profile_observables = (): void => {
  const horse = bindProfileGaits(HORSE_PROFILE, "horse", 48);
  TestValidator.predicate(
    "horse walk duration matches handwritten clip",
    nclose(horse.walk!.duration, horseHandAuthored.walk.duration),
  );
  TestValidator.predicate(
    "horse trot duration matches handwritten clip",
    nclose(horse.trot!.duration, horseHandAuthored.trot.duration),
  );
  TestValidator.predicate(
    "horse gallop duration matches handwritten clip",
    nclose(horse.gallop!.duration, horseHandAuthored.gallop.duration),
  );
  TestValidator.predicate(
    "horse rear duration matches handwritten clip",
    nclose(horse.rear!.duration, horseHandAuthored.rear.duration),
  );
  TestValidator.equals(
    "horse walk preserves left foreleg envelope",
    namedFacts([
      [
        "coversRangeFlexionRangeHorse",
        () =>
          coversRange(
            flexionRange(horse.walk!, "leftUpperArm"),
            horseHandAuthored.walk.leftUpperArm,
            3,
          ),
      ],
      [
        "coversRangeFlexionRangeHorse2",
        () =>
          coversRange(
            flexionRange(horse.walk!, "leftLowerArm"),
            horseHandAuthored.walk.leftLowerArm,
            2,
          ),
      ],
    ]),
    { coversRangeFlexionRangeHorse: true, coversRangeFlexionRangeHorse2: true },
  );
  TestValidator.equals(
    "horse trot preserves left foreleg and high-root envelope",
    namedFacts([
      [
        "coversRangeFlexionRangeHorse",
        () =>
          coversRange(
            flexionRange(horse.trot!, "leftUpperArm"),
            horseHandAuthored.trot.leftUpperArm,
            4,
          ),
      ],
      [
        "coversRangeFlexionRangeHorse2",
        () =>
          coversRange(
            flexionRange(horse.trot!, "leftLowerArm"),
            horseHandAuthored.trot.leftLowerArm,
            2,
          ),
      ],
      [
        "rootYRangeHorseTrot",
        () =>
          rootYRange(horse.trot!).max >=
          horseHandAuthored.trot.rootY.max - 0.005,
      ],
    ]),
    {
      coversRangeFlexionRangeHorse: true,
      coversRangeFlexionRangeHorse2: true,
      rootYRangeHorseTrot: true,
    },
  );
  TestValidator.equals(
    "horse gallop preserves gather and suspension envelope",
    namedFacts([
      [
        "coversRangeFlexionRangeHorse",
        () =>
          coversRange(
            flexionRange(horse.gallop!, "leftUpperArm"),
            horseHandAuthored.gallop.leftUpperArm,
            4,
          ),
      ],
      [
        "coversRangeFlexionRangeHorse2",
        () =>
          coversRange(
            flexionRange(horse.gallop!, "leftLowerArm"),
            horseHandAuthored.gallop.leftLowerArm,
            3,
          ),
      ],
      [
        "closesRangeRootYRangeHorse",
        () =>
          closesRange(
            rootYRange(horse.gallop!),
            horseHandAuthored.gallop.rootY,
            0.01,
          ),
      ],
    ]),
    {
      coversRangeFlexionRangeHorse: true,
      coversRangeFlexionRangeHorse2: true,
      closesRangeRootYRangeHorse: true,
    },
  );
  TestValidator.equals(
    "horse rear preserves paw and spine envelope",
    namedFacts([
      [
        "coversRangeFlexionRangeHorse",
        () =>
          coversRange(
            flexionRange(horse.rear!, "leftUpperArm"),
            horseHandAuthored.rear.leftUpperArm,
            5,
          ),
      ],
      [
        "coversRangeFlexionRangeHorse2",
        () =>
          coversRange(
            flexionRange(horse.rear!, "leftLowerArm"),
            horseHandAuthored.rear.leftLowerArm,
            5,
          ),
      ],
      [
        "coversRangeFlexionRangeHorse3",
        () =>
          coversRange(
            flexionRange(horse.rear!, "spine"),
            horseHandAuthored.rear.spine,
            4,
          ),
      ],
    ]),
    {
      coversRangeFlexionRangeHorse: true,
      coversRangeFlexionRangeHorse2: true,
      coversRangeFlexionRangeHorse3: true,
    },
  );

  const cat = bindProfileGaits(CAT_PROFILE, "cat", 48);
  TestValidator.predicate(
    "cat walk duration matches handwritten clip",
    nclose(cat.walk!.duration, catHandAuthored.walk.duration),
  );
  TestValidator.predicate(
    "cat leap duration matches handwritten clip",
    nclose(cat.leap!.duration, catHandAuthored.leap.duration),
  );
  TestValidator.equals(
    "cat walk preserves diagonal gait envelopes",
    namedFacts([
      [
        "coversRangeFlexionRangeCat",
        () =>
          coversRange(
            flexionRange(cat.walk!, "leftUpperArm"),
            catHandAuthored.walk.leftUpperArm,
            3,
          ),
      ],
      [
        "coversRangeFlexionRangeCat2",
        () =>
          coversRange(
            flexionRange(cat.walk!, "leftLowerArm"),
            catHandAuthored.walk.leftLowerArm,
            2,
          ),
      ],
      [
        "coversRangeFlexionRangeCat3",
        () =>
          coversRange(
            flexionRange(cat.walk!, "leftUpperLeg"),
            catHandAuthored.walk.leftUpperLeg,
            3,
          ),
      ],
      [
        "coversRangeFlexionRangeCat4",
        () =>
          coversRange(
            flexionRange(cat.walk!, "rightLowerLeg"),
            catHandAuthored.walk.rightLowerLeg,
            2,
          ),
      ],
    ]),
    {
      coversRangeFlexionRangeCat: true,
      coversRangeFlexionRangeCat2: true,
      coversRangeFlexionRangeCat3: true,
      coversRangeFlexionRangeCat4: true,
    },
  );
  TestValidator.equals(
    "cat leap preserves crouch and airborne envelope",
    namedFacts([
      [
        "coversRangeFlexionRangeCat",
        () =>
          coversRange(
            flexionRange(cat.leap!, "leftUpperArm"),
            catHandAuthored.leap.leftUpperArm,
            3,
          ),
      ],
      [
        "coversRangeFlexionRangeCat2",
        () =>
          coversRange(
            flexionRange(cat.leap!, "leftLowerArm"),
            catHandAuthored.leap.leftLowerArm,
            2,
          ),
      ],
      [
        "coversRangeFlexionRangeCat3",
        () =>
          coversRange(
            flexionRange(cat.leap!, "leftUpperLeg"),
            catHandAuthored.leap.leftUpperLeg,
            4,
          ),
      ],
      [
        "coversRangeFlexionRangeCat4",
        () =>
          coversRange(
            flexionRange(cat.leap!, "leftLowerLeg"),
            catHandAuthored.leap.leftLowerLeg,
            3,
          ),
      ],
      [
        "closesRangeRootYRangeCat",
        () =>
          closesRange(rootYRange(cat.leap!), catHandAuthored.leap.rootY, 0.02),
      ],
    ]),
    {
      coversRangeFlexionRangeCat: true,
      coversRangeFlexionRangeCat2: true,
      coversRangeFlexionRangeCat3: true,
      coversRangeFlexionRangeCat4: true,
      closesRangeRootYRangeCat: true,
    },
  );
};
