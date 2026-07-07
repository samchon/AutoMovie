import {
  followPathMotion,
  plantStanceFeet,
  spaceGround,
  validateFootSkate,
  validateGroundContact,
} from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieSpace,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});
const v = (x: number, z: number, y = 0) => ({ x, y, z });

/** A ramp rising 0 → 0.4 over x=0..2, wide enough for the whole path. */
const space: IAutoMovieSpace = {
  id: "set",
  surfaces: [
    {
      id: "ramp",
      kind: "ramp",
      polygon: [v(-1, -2), v(3, -2), v(3, 2), v(-1, 2)],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: { x: 2, y: 0.4, z: 0 },
    },
  ],
  walkable: ["ramp"],
};

// The bent-rest leg of the plant-feet suites: foot on the ground with reach
// slack, so the pin can hold while the root climbs the ramp.
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
const gait: IAutoMovieMotion = {
  id: "stand",
  skeleton: "leg",
  duration: 1,
  loop: true,
  keyframes: [kf(0), kf(0.5), kf(1)],
};

/**
 * `spaceGround` is the adapter that plugs a space into every ground seam: the
 * path bake climbs the ramp, the ground-IK pass plants feet against the same
 * heights, and the contact validator judges against them — the full space →
 * path → feet pipeline on one surface set.
 *
 * Scenarios (a 0.15 m climb — short enough for one stance pin to stay inside
 * the leg's reach while the hip walks and rises, as the flat pipeline test):
 *
 * 1. `followPathMotion` with the space ground climbs the ramp: the mid-path
 *    frame's `y` is the ramp height there (hand oracle: h(x)=0.2x → 0.015 at
 *    x=0.075).
 * 2. Off the surfaces the adapter falls back — `0` by default, or the caller's
 *    explicit fallback height.
 * 3. The raw ramp bake skates the foot (negative twin), and `plantStanceFeet` with
 *    the same space ground corrects it: the corrected clip passes
 *    `validateFootSkate`.
 * 4. The corrected clip also passes `validateGroundContact` judged against the
 *    space heights — feet neither sink into nor float off the ramp.
 */
export const test_space_ground_pipeline = (): void => {
  const ground = spaceGround(space);
  const path = followPathMotion({
    id: "climb",
    gait,
    waypoints: [v(0, 0), v(0.15, 0)],
    speed: 0.15,
    ground,
  });
  const mid = path.frames.find((frame) => nclose(frame.time, 0.5));
  TestValidator.predicate(
    "mid-path frame follows the ramp height",
    mid !== undefined && nclose(mid.position.y, 0.015),
  );

  TestValidator.predicate("default fallback is 0", nclose(ground(50, 50), 0));
  TestValidator.predicate(
    "explicit fallback height",
    nclose(spaceGround(space, 7)(50, 50), 7),
  );

  const contacts = [{ bone: "leftFoot", start: 0, end: 1 } as const];
  TestValidator.equals(
    "raw ramp bake skates the foot",
    validateFootSkate({
      motion: path.motion,
      skeleton: legSkeleton,
      contacts,
    }).success,
    false,
  );

  const planted = plantStanceFeet({
    skeleton: legSkeleton,
    motion: path.motion,
    groundY: ground,
    tolerance: 0.05,
    legs: [{ foot: "leftFoot", upper: "leftUpperLeg", lower: "leftLowerLeg" }],
  });
  TestValidator.equals(
    "planted ramp climb passes foot-skate",
    validateFootSkate({
      motion: planted.motion,
      skeleton: legSkeleton,
      contacts,
    }).success,
    true,
  );
  TestValidator.equals(
    "planted ramp climb passes ground contact on the space",
    validateGroundContact({
      motion: planted.motion,
      skeleton: legSkeleton,
      footBones: ["leftFoot"],
      groundY: ground,
      tolerance: 1e-3,
    }).success,
    true,
  );
};
