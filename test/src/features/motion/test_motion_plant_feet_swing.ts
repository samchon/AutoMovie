import { plantStanceFeet } from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const skeleton: IAutoMovieSkeleton = {
  id: "leg",
  bones: [
    { bone: "hips", parent: null, rest: t(0, 0.8, 0), constraint: null },
    {
      bone: "leftUpperLeg",
      parent: "hips",
      rest: t(0.1, 0, 0),
      constraint: null,
    },
    {
      bone: "leftLowerLeg",
      parent: "leftUpperLeg",
      rest: t(0, -0.4, 0.15),
      constraint: null,
    },
    {
      bone: "leftFoot",
      parent: "leftLowerLeg",
      rest: t(0, -0.4, -0.15),
      constraint: null,
    },
  ],
};

const LEG = {
  foot: "leftFoot",
  upper: "leftUpperLeg",
  lower: "leftLowerLeg",
} as const;

const motion = (peakY: number): IAutoMovieMotion => ({
  id: "bob",
  skeleton: "leg",
  duration: 1,
  loop: false,
  keyframes: [
    {
      time: 0,
      pose: { skeleton: "leg", root: t(0, 0, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
    {
      time: 0.5,
      pose: { skeleton: "leg", root: t(0, peakY, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
    {
      time: 1,
      pose: { skeleton: "leg", root: t(0, 0, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
  ],
});

/**
 * The pass detects stance runs, not the whole clip: a foot that lifts off the
 * ground in a swing splits the stance into runs on either side, and a foot that
 * never touches down is never planted.
 *
 * Scenarios:
 *
 * 1. A foot that lifts mid-clip and lands again yields two stance runs (the middle
 *    swing frames are left untouched).
 * 2. A foot lifted clear of the ground for the whole clip yields no runs.
 */
export const test_motion_plant_feet_swing = (): void => {
  const swung = plantStanceFeet({
    skeleton,
    motion: motion(0.5),
    groundY: 0,
    tolerance: 0.02,
    legs: [LEG],
    sampleRate: 4,
  });
  TestValidator.equals("stance splits into two runs", swung.plants.length, 2);

  const lifted: IAutoMovieMotion = {
    id: "lifted",
    skeleton: "leg",
    duration: 1,
    loop: false,
    keyframes: [
      {
        time: 0,
        pose: { skeleton: "leg", root: t(0, 1, 0), joints: [] },
        expression: null,
        easing: "linear",
        bezier: null,
      },
      {
        time: 1,
        pose: { skeleton: "leg", root: t(0, 1, 0), joints: [] },
        expression: null,
        easing: "linear",
        bezier: null,
      },
    ],
  };
  const airborne = plantStanceFeet({
    skeleton,
    motion: lifted,
    groundY: 0,
    tolerance: 0.02,
    legs: [LEG],
    sampleRate: 4,
  });
  TestValidator.equals(
    "a foot never in contact is never planted",
    airborne.plants.length,
    0,
  );
};
