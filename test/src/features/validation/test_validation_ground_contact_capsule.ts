import { validateGroundContact } from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeMotion } from "../internal/fixtures";
import { hasViolation, hasWarning, warningCount } from "../internal/predicates";

const restAt = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/**
 * Hips at world y=1, chest at 1.5, leftHand at 0.1: a body standing over y=0
 * ground with one low hand. A hips→leftHand capsule of radius 0.2 dips to y =
 * 0.1 − 0.2 = −0.1, penetrating; hips→chest (radius 0.2, lowest 0.8) clears.
 */
const body: IAutoMovieSkeleton = {
  id: "capsule-body",
  bones: [
    { bone: "hips", parent: null, rest: restAt(0, 1, 0), constraint: null },
    {
      bone: "chest",
      parent: "hips",
      rest: restAt(0, 0.5, 0),
      constraint: null,
    },
    {
      bone: "leftHand",
      parent: "hips",
      rest: restAt(0, -0.9, 0),
      constraint: null,
    },
  ],
};

/** Hips reachable, leftFoot declared under an absent `leftLowerLeg` → detached. */
const detached: IAutoMovieSkeleton = {
  id: "capsule-detached",
  bones: [
    { bone: "hips", parent: null, rest: restAt(0, 1, 0), constraint: null },
    {
      bone: "leftFoot",
      parent: "leftLowerLeg",
      rest: restAt(0, -0.9, 0),
      constraint: null,
    },
  ],
};

const pose = (skeletonId: string): IAutoMoviePose => ({
  skeleton: skeletonId,
  root: restAt(0, 0, 0),
  joints: [],
});
const key = (skeletonId: string, time: number): IAutoMovieKeyframe => ({
  time,
  pose: pose(skeletonId),
  expression: null,
  easing: "linear",
  bezier: null,
});
const still = (target: IAutoMovieSkeleton) =>
  makeMotion([key(target.id, 0), key(target.id, 1)], 1);

/**
 * The whole-body capsule sweep (#1185): `validateGroundContact` checked only
 * foot points, so a hand, hip, or elbow clipping through the floor was
 * invisible. A capsule proxy's lowest surface point (`min(from.y, to.y) −
 * radius`) is now swept against the ground too: advisory, like the foot check,
 * and total (a detached endpoint is an error, not a silent skip).
 *
 * Scenarios (all isolate the sweep with `footBones: []`):
 *
 * 1. A hips→hand capsule whose radius sinks its lowest point below the ground
 *    warns at `$input.samples[i].capsules[0].lowestY` while the run succeeds.
 * 2. A hips→chest capsule that stays well above the ground raises no warning.
 * 3. Reversing the endpoints (hand→hips) still finds the low hand as the deepest
 *    point: the endpoint reduction is order-independent.
 * 4. `physicsIntent` suppresses the capsule warning, exactly as it does the foot
 *    warning.
 * 5. A capsule on a detached endpoint is a `type` error (not reachable), not a
 *    silent skip or a crash: the totality contract the point check lacks.
 */
export const test_validation_ground_contact_capsule = (): void => {
  const sunk = validateGroundContact({
    motion: still(body),
    skeleton: body,
    footBones: [],
    capsules: [{ from: "hips", to: "leftHand", radius: 0.2 }],
    sampleRate: 1,
  });
  TestValidator.predicate(
    "a capsule dipping below ground warns but succeeds",
    sunk.success === true &&
      hasWarning(sunk, "physics", "$input.samples[0].capsules[0].lowestY"),
  );

  const clear = validateGroundContact({
    motion: still(body),
    skeleton: body,
    footBones: [],
    capsules: [{ from: "hips", to: "chest", radius: 0.2 }],
    sampleRate: 1,
  });
  TestValidator.equals(
    "a capsule above the ground raises no warning",
    clear.success === true && warningCount(clear),
    0,
  );

  const reversed = validateGroundContact({
    motion: still(body),
    skeleton: body,
    footBones: [],
    capsules: [{ from: "leftHand", to: "hips", radius: 0.2 }],
    sampleRate: 1,
  });
  TestValidator.predicate(
    "the deepest endpoint is found regardless of capsule order",
    reversed.success === true &&
      hasWarning(reversed, "physics", "$input.samples[0].capsules[0].lowestY"),
  );

  const acknowledged = validateGroundContact({
    motion: still(body),
    skeleton: body,
    footBones: [],
    capsules: [{ from: "hips", to: "leftHand", radius: 0.2 }],
    sampleRate: 1,
    physicsIntent: "phasing",
  });
  TestValidator.equals(
    "physicsIntent suppresses the capsule warning",
    acknowledged.success === true && warningCount(acknowledged),
    0,
  );

  const bad = validateGroundContact({
    motion: still(detached),
    skeleton: detached,
    footBones: [],
    capsules: [{ from: "hips", to: "leftFoot", radius: 0.2 }],
    sampleRate: 1,
  });
  TestValidator.predicate(
    "a detached capsule endpoint is a reachability error, not a crash",
    bad.success === false &&
      hasViolation(bad, "type", "$input.capsules[0].to") &&
      bad.violations.some((v) => v.expected.includes("not reachable")),
  );
};
