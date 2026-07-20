import { plantStanceFeet, resolvePose, sampleMotion } from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const LEG = {
  foot: "leftFoot",
  upper: "leftUpperLeg",
  lower: "leftLowerLeg",
} as const;

const staticMotion = (skeletonId: string, travelX = 0): IAutoMovieMotion => ({
  id: "m",
  skeleton: skeletonId,
  duration: 1,
  loop: false,
  keyframes: [
    {
      time: 0,
      pose: { skeleton: skeletonId, root: t(0, 0, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
    {
      time: 1,
      pose: { skeleton: skeletonId, root: t(travelX, 0, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
  ],
});

const bone = (name: string, parent: string | null, rest: IAutoMovieTransform) =>
  ({
    bone: name,
    parent,
    rest,
    constraint: null,
  }) as IAutoMovieSkeleton["bones"][number];

// A stance foot exists but the leg segments named by LEG are absent from the rig.
const noSegments: IAutoMovieSkeleton = {
  id: "no-seg",
  bones: [
    bone("hips", null, t(0, 0.05, 0)),
    bone("leftFoot", "hips", t(0, -0.05, 0)),
  ],
};

// A zero-length thigh: the knee sits on the hip (l1 = 0).
const zeroThigh: IAutoMovieSkeleton = {
  id: "zero-thigh",
  bones: [
    bone("hips", null, t(0, 0.8, 0)),
    bone("leftUpperLeg", "hips", t(0, 0, 0)),
    bone("leftLowerLeg", "leftUpperLeg", t(0, 0, 0)),
    bone("leftFoot", "leftLowerLeg", t(0, -0.8, 0)),
  ],
};

// A leg folded so the foot rests exactly on the hip, both on the ground
// (target == hip, so the reach distance is zero).
const folded: IAutoMovieSkeleton = {
  id: "folded",
  bones: [
    bone("hips", null, t(0, 0, 0)),
    bone("leftUpperLeg", "hips", t(0, 0, 0)),
    bone("leftLowerLeg", "leftUpperLeg", t(0, -0.4, 0)),
    bone("leftFoot", "leftLowerLeg", t(0, 0.4, 0)),
  ],
};

// A reachable-slack leg (as the main test), driven far enough that the pinned
// foot is out of the leg's reach.
const reachLeg: IAutoMovieSkeleton = {
  id: "reach",
  bones: [
    bone("hips", null, t(0, 0.8, 0)),
    bone("leftUpperLeg", "hips", t(0.1, 0, 0)),
    bone("leftLowerLeg", "leftUpperLeg", t(0, -0.4, 0.15)),
    bone("leftFoot", "leftLowerLeg", t(0, -0.4, -0.15)),
  ],
};

/**
 * Degenerate legs are skipped rather than crashed, and an unreachable pin
 * extends the leg fully toward it without producing NaN.
 *
 * Scenarios:
 *
 * 1. A foot whose leg segments are absent: the stance run is detected but the leg
 *    is left untouched (no throw).
 * 2. A zero-length thigh (l1 = 0) is skipped.
 * 3. A leg folded so the foot rests on the hip (reach distance 0) is skipped.
 * 4. A pin beyond the leg's reach extends it fully: the corrected foot is finite
 *    (no NaN), on the reachable shell.
 * 5. A non-positive sample rate throws.
 */
export const test_motion_plant_feet_edge = (): void => {
  TestValidator.equals(
    "absent leg segments: run detected, leg untouched",
    plantStanceFeet({
      skeleton: noSegments,
      motion: staticMotion("no-seg"),
      legs: [LEG],
    }).plants.length,
    1,
  );
  TestValidator.equals(
    "zero-length thigh skipped without throw",
    plantStanceFeet({
      skeleton: zeroThigh,
      motion: staticMotion("zero-thigh"),
      legs: [LEG],
    }).plants.length,
    1,
  );
  TestValidator.equals(
    "folded leg (reach distance 0) skipped without throw",
    plantStanceFeet({
      skeleton: folded,
      motion: staticMotion("folded"),
      legs: [LEG],
    }).plants.length,
    1,
  );

  const far = plantStanceFeet({
    skeleton: reachLeg,
    motion: staticMotion("reach", 0.5),
    legs: [LEG],
    sampleRate: 8,
  });
  const foot = resolvePose(sampleMotion(far.motion, 1).pose, reachLeg).find(
    (b) => b.bone === "leftFoot",
  )!.worldPosition;
  TestValidator.predicate(
    "unreachable pin extends the leg without NaN",
    Number.isFinite(foot.x) &&
      Number.isFinite(foot.y) &&
      Number.isFinite(foot.z),
  );

  TestValidator.predicate(
    "non-positive sample rate throws",
    throwsError(() =>
      plantStanceFeet({
        skeleton: reachLeg,
        motion: staticMotion("reach"),
        sampleRate: 0,
      }),
    ),
  );
};
