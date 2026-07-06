import { validateGroundContact } from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeMotion } from "../internal/fixtures";
import { hasViolation, nclose, violationCount } from "../internal/predicates";

const restAt = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const SKELETON: IAutoMovieSkeleton = {
  id: "skeleton-1",
  bones: [
    { bone: "hips", parent: null, rest: restAt(0, 1, 0), constraint: null },
    {
      bone: "leftUpperLeg",
      parent: "hips",
      rest: restAt(0.1, -0.5, 0),
      constraint: null,
    },
    {
      bone: "leftLowerLeg",
      parent: "leftUpperLeg",
      rest: restAt(0, -0.4, 0),
      constraint: null,
    },
    {
      bone: "leftFoot",
      parent: "leftLowerLeg",
      rest: restAt(0, -0.1, 0),
      constraint: null,
    },
  ],
};

const root = (y: number): IAutoMovieTransform => ({
  translation: { x: 0, y, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const pose = (rootY: number): IAutoMoviePose => ({
  skeleton: SKELETON.id,
  root: root(rootY),
  joints: [],
});

const key = (time: number, rootY: number): IAutoMovieKeyframe => ({
  time,
  pose: pose(rootY),
  expression: null,
  easing: "linear",
  bezier: null,
});

/**
 * `validateGroundContact` is the first opt-in Tier-3 motion validator: it
 * samples a clip, resolves foot bones through FK, and rejects world-space foot
 * penetration below a ground plane.
 *
 * Scenarios:
 *
 * 1. A root dip below the ground produces physics violations with a stable
 *    `$input.samples[i].leftFoot.worldPosition.y` path.
 * 2. A small dip inside tolerance is accepted, proving the validator can avoid
 *    false positives for near-ground numerical graze.
 * 3. A custom ground plane and custom path are reflected in the emitted violation
 *    path and overshoot.
 */
export const test_validation_ground_contact = (): void => {
  const dipping = makeMotion([key(0, 0), key(0.5, -0.2), key(1, 0)], 1);
  const rejected = validateGroundContact({
    motion: dipping,
    skeleton: SKELETON,
    sampleRate: 4,
  });
  TestValidator.predicate(
    "penetration rejected",
    hasViolation(
      rejected,
      "physics",
      "$input.samples[2].leftFoot.worldPosition.y",
    ),
  );
  const mid =
    rejected.success === false
      ? rejected.violations.find((v) => v.path.includes("samples[2]"))
      : null;
  TestValidator.predicate(
    "penetration overshoot",
    mid?.kind === "physics" && nclose(mid.overshoot ?? -1, 0.2),
  );

  const grazing = makeMotion([key(0, 0), key(0.5, -0.02), key(1, 0)], 1);
  TestValidator.equals(
    "tolerance accepts graze",
    validateGroundContact({
      motion: grazing,
      skeleton: SKELETON,
      footBones: ["leftFoot"],
      tolerance: 0.03,
    }).success,
    true,
  );

  const raisedGround = validateGroundContact({
    motion: makeMotion([key(0, 0), key(1, 0)], 1),
    skeleton: SKELETON,
    footBones: ["leftFoot"],
    groundY: 0.1,
    sampleRate: 1,
    path: "$motion",
  });
  TestValidator.predicate(
    "custom path",
    hasViolation(
      raisedGround,
      "physics",
      "$motion.samples[0].leftFoot.worldPosition.y",
    ),
  );
  TestValidator.equals(
    "custom ground samples",
    violationCount(raisedGround),
    2,
  );
};
