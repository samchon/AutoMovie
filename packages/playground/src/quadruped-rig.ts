import { IAutoMovieJointAxes, IAutoMovieRestFrame } from "@automovie/engine";
import { AutoMovieHumanoidBone } from "@automovie/interface";

type JointAxesTable = Partial<
  Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>
>;
type RestFrameTable = Partial<
  Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
>;

/**
 * Cat and horse playground rigs reuse humanoid upper-arm bone names for front
 * legs. Keep their authored clips in raw rig-space; `HUMANOID_REST_FRAME` is
 * calibrated for T-pose humanoid arms and would reinterpret those front legs.
 */
export const QUADRUPED_JOINT_AXES: JointAxesTable | undefined = undefined;
export const QUADRUPED_REST_FRAME: RestFrameTable | undefined = undefined;
