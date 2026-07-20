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

// Only a left leg; the default legs also name rightFoot, which is absent.
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
      pose: { skeleton: "leg", root: t(0.15, 0, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
  ],
};

/**
 * With no options the pass uses the default ground plane (0), tolerance (0.02),
 * sample rate (24), and both humanoid legs. A leg whose foot bone is absent
 * from the rig contributes no stance; it is simply skipped, not an error.
 *
 * Scenarios:
 *
 * 1. The default left leg plants (one run for leftFoot).
 * 2. The absent rightFoot (named by the default legs) produces no run.
 */
export const test_motion_plant_feet_defaults = (): void => {
  const planted = plantStanceFeet({ skeleton, motion: skating });
  TestValidator.equals(
    "only the left foot is planted",
    planted.plants.length,
    1,
  );
  TestValidator.equals(
    "the planted foot is leftFoot",
    planted.plants[0]!.foot,
    "leftFoot",
  );
};
