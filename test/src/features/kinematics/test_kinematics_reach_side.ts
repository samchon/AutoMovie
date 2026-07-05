import { reachPose } from "@automovie/engine";
import { IAutoMovieSkeleton, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton } from "../internal/fixtures";

const withRightHand = (): IAutoMovieSkeleton => {
  const skeleton = createSkeleton();
  skeleton.bones.push({
    bone: "rightHand",
    parent: "rightLowerArm",
    rest: {
      translation: { x: -0.25, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    constraint: null,
  });
  return skeleton;
};

/**
 * `reachPose` receives `side` from runtime harness calls. Unknown strings must
 * not silently fall through to the right arm just because the TypeScript union
 * is erased at runtime.
 *
 * Scenarios:
 *
 * 1. A complete right-arm chain still solves for the valid `"right"` side.
 * 2. An unknown side value returns `null` instead of solving the right arm.
 */
export const test_kinematics_reach_side = (): void => {
  const skeleton = withRightHand();
  const target: IAutoMovieVector3 = { x: -0.4, y: 1.1, z: 0.2 };

  TestValidator.predicate(
    "valid right side still solves",
    reachPose(skeleton, "right", target) !== null,
  );

  const invalidSide = "center" as Parameters<typeof reachPose>[1];
  TestValidator.predicate(
    "invalid side returns null",
    reachPose(skeleton, invalidSide, target) === null,
  );
};
