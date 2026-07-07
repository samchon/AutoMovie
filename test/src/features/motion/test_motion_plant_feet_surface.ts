import { plantStanceFeet } from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { vclose } from "../internal/predicates";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

// The bent-rest leg of the plant-feet suites; foot lands at world
// (root + 0.1, root.y - 0.8, 0).
const legSkeleton: IAutoMovieSkeleton = {
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

const still = (rootX: number): IAutoMovieMotion => ({
  id: "still",
  skeleton: "leg",
  duration: 0.5,
  loop: false,
  keyframes: [0, 0.5].map(
    (time): IAutoMovieKeyframe => ({
      time,
      pose: { skeleton: "leg", root: t(rootX, 0, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    }),
  ),
});

/** Ground rises with x: h(x) = 0.2·x. */
const rising = (x: number): number => 0.2 * x;

/**
 * `plantStanceFeet` pins against the ground height at the stance-start contact,
 * not a global plane: on a slope the pin's `y` is the local surface height, so
 * a foot standing uphill plants higher than one at the origin — and a constant
 * callback stays identical to the scalar it generalizes.
 *
 * Scenarios (stationary stand at root x=1 → foot world x=1.1):
 *
 * 1. On the rising slope the stance is detected against the local height and the
 *    plant pins at `y = h(1.1) = 0.22` (hand oracle).
 * 2. The same stand planted with the constant callback `() => 0` produces exactly
 *    the scalar `groundY: 0` plant — the widened parameter preserved the scalar
 *    behavior.
 */
export const test_motion_plant_feet_surface = (): void => {
  const sloped = plantStanceFeet({
    skeleton: legSkeleton,
    motion: still(1),
    groundY: rising,
    tolerance: 0.25,
    legs: [LEG],
  });
  TestValidator.equals("one stance run on the slope", sloped.plants.length, 1);
  TestValidator.predicate(
    "pin sits at the local slope height",
    vclose(sloped.plants[0]!.position, { x: 1.1, y: 0.22, z: 0 }),
  );

  const scalar = plantStanceFeet({
    skeleton: legSkeleton,
    motion: still(1),
    groundY: 0,
    tolerance: 0.25,
    legs: [LEG],
  });
  const constant = plantStanceFeet({
    skeleton: legSkeleton,
    motion: still(1),
    groundY: () => 0,
    tolerance: 0.25,
    legs: [LEG],
  });
  TestValidator.equals(
    "constant callback plants exactly as the scalar",
    constant.plants,
    scalar.plants,
  );
};
