import {
  followPathMotion,
  plantStanceFeet,
  validateFootSkate,
  validateGroundContact,
} from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { warningCount } from "../internal/predicates";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

// A bent-rest leg (as the plant-feet suite): foot on the ground with reach
// slack, so the leg can hold its pin while the root walks the path.
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

const kf = (time: number): IAutoMovieKeyframe => ({
  time,
  pose: { skeleton: "leg", root: null, joints: [] },
  expression: null,
  easing: "linear",
  bezier: null,
});

/** A stationary 1 s cycle — all travel comes from the path bake. */
const gait: IAutoMovieMotion = {
  id: "stand",
  skeleton: "leg",
  duration: 1,
  loop: true,
  keyframes: [kf(0), kf(1)],
};

const LEG = {
  foot: "leftFoot",
  upper: "leftUpperLeg",
  lower: "leftLowerLeg",
} as const;

/**
 * Path locomotion composes with the ground-IK pass (#596): a path-baked walk
 * whose raw root drag skates the foot is corrected by plantStanceFeet into a
 * clip that passes the very foot-skate and ground-contact validators the raw
 * bake fails — the full "walk a path, feet planted" pipeline on flat ground.
 *
 * Scenarios (0.2 m path at 0.2 m/s → one cycle, root slides 0.2 m, yaw 90°):
 *
 * 1. The raw path bake warns from validateFootSkate — the foot rides the root at
 *    0.2 m/s through its contact window.
 * 2. PlantStanceFeet over the bake passes validateFootSkate: the stance foot is
 *    pinned while the hip walks the path (through the rotated frame the path's
 *    facing put the rig in).
 * 3. The corrected clip also passes validateGroundContact at the plane.
 */
export const test_motion_path_plant_feet = (): void => {
  const path = followPathMotion({
    id: "walk-short",
    gait,
    waypoints: [
      { x: 0, y: 0, z: 0 },
      { x: 0.2, y: 0, z: 0 },
    ],
    speed: 0.2,
  });
  const contacts = [{ bone: "leftFoot", start: 0, end: 1 } as const];

  TestValidator.predicate(
    "raw path bake skates the foot (warns)",
    warningCount(
      validateFootSkate({
        motion: path.motion,
        skeleton: legSkeleton,
        contacts,
      }),
    ) > 0,
  );

  const planted = plantStanceFeet({
    skeleton: legSkeleton,
    motion: path.motion,
    groundY: 0,
    tolerance: 0.02,
    legs: [LEG],
    sampleRate: 24,
  });
  TestValidator.equals(
    "planted path walk has no foot-skate warning",
    warningCount(
      validateFootSkate({
        motion: planted.motion,
        skeleton: legSkeleton,
        contacts,
      }),
    ),
    0,
  );
  TestValidator.equals(
    "planted path walk has no ground-contact warning",
    warningCount(
      validateGroundContact({
        motion: planted.motion,
        skeleton: legSkeleton,
        footBones: ["leftFoot"],
        groundY: 0,
        tolerance: 1e-3,
      }),
    ),
    0,
  );
};
