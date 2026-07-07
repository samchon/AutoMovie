import { plantStanceFeet, resolvePose, sampleMotion } from "@automovie/engine";
import { validateFootSkate } from "@automovie/engine";
import { validateGroundContact } from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

// A bent-rest leg: foot at the ground (y=0) with the hip only 0.8 up over a
// 0.85 leg, so the leg has horizontal reach slack to plant while the hip travels.
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

// The whole body (and the planted foot) slides +x — a baked gait skating.
const skating: IAutoMovieMotion = {
  id: "skate",
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
      time: 1,
      pose: { skeleton: "leg", root: t(0.2, 0, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
  ],
};

const LEG = {
  foot: "leftFoot",
  upper: "leftUpperLeg",
  lower: "leftLowerLeg",
} as const;

const footAt = (motion: IAutoMovieMotion, time: number) =>
  resolvePose(sampleMotion(motion, time).pose, legSkeleton).find(
    (b) => b.bone === "leftFoot",
  )!.worldPosition;

/**
 * The ground-IK pass plants a stance foot: sampled across its stance run the
 * foot's world XZ is held constant, so a baked gait that skated the foot now
 * passes the very foot-skate and ground-contact validators it failed.
 *
 * Scenarios:
 *
 * 1. The raw skating clip fails validateFootSkate (foot slides 0.2 m/s).
 * 2. The foot-corrected clip passes validateFootSkate over the same window.
 * 3. The corrected clip passes validateGroundContact (foot held at the plane).
 * 4. The planted foot's world XZ is constant across the run (the anti-skate
 *    property, numeric) and pinned to the stance-start contact.
 * 5. One stance run is reported for the whole clip, pinned at y = groundY.
 */
export const test_motion_plant_feet = (): void => {
  const contacts = [{ bone: "leftFoot", start: 0, end: 1 } as const];

  const raw = validateFootSkate({
    motion: skating,
    skeleton: legSkeleton,
    contacts,
  });
  TestValidator.equals("raw gait skates the foot", raw.success, false);

  const planted = plantStanceFeet({
    skeleton: legSkeleton,
    motion: skating,
    groundY: 0,
    tolerance: 0.02,
    legs: [LEG],
    sampleRate: 24,
  });

  TestValidator.equals(
    "corrected clip passes foot-skate",
    validateFootSkate({
      motion: planted.motion,
      skeleton: legSkeleton,
      contacts,
    }).success,
    true,
  );
  TestValidator.equals(
    "corrected clip passes ground contact",
    validateGroundContact({
      motion: planted.motion,
      skeleton: legSkeleton,
      footBones: ["leftFoot"],
      groundY: 0,
      tolerance: 1e-3,
    }).success,
    true,
  );

  const start = footAt(planted.motion, 0);
  for (const time of [0, 0.25, 0.5, 0.75, 1])
    TestValidator.predicate(
      `foot XZ pinned at t=${time}`,
      (() => {
        const p = footAt(planted.motion, time);
        return (
          nclose(p.x, 0.1, 1e-4) && nclose(p.z, 0, 1e-4) && nclose(p.y, 0, 1e-4)
        );
      })(),
    );
  TestValidator.predicate(
    "pin equals stance-start contact",
    nclose(start.x, 0.1, 1e-4),
  );

  TestValidator.equals("one stance run", planted.plants.length, 1);
  TestValidator.predicate(
    "run spans the clip pinned to ground",
    planted.plants[0]!.foot === "leftFoot" &&
      nclose(planted.plants[0]!.start, 0) &&
      nclose(planted.plants[0]!.end, 1) &&
      nclose(planted.plants[0]!.position.y, 0),
  );
};
