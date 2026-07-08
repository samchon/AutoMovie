import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { decomposeJointRotation } from "../kinematics/decomposeJointRotation";
import { IAutoMovieResolvedBone, resolvePose } from "../kinematics/resolvePose";
import { twoBoneChainArticulation } from "../kinematics/twoBoneChainArticulation";
import {
  IAutoMovieFootLeg,
  IAutoMovieFootPlant,
  IAutoMoviePlantedFeet,
} from "./plantFeet";
import { sampleMotion } from "./sampleMotion";

/**
 * Re-key the sampled frames densely, re-solving every pinned leg onto its
 * stance target — the assembly stage of {@link plantStanceFeet}.
 */
export const rekeyPlantedFeet = (props: {
  skeleton: IAutoMovieSkeleton;
  times: readonly number[];
  poses: ReadonlyArray<ReturnType<typeof sampleMotion>>;
  legs: readonly IAutoMovieFootLeg[];
  targets: ReadonlyArray<ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>>;
}): IAutoMovieKeyframe[] =>
  props.times.map((time, index) => ({
    time,
    pose: {
      skeleton: props.poses[index]!.pose.skeleton,
      root: props.poses[index]!.pose.root,
      joints: plantedJoints(
        props.skeleton,
        props.poses[index]!.pose,
        props.legs,
        props.targets[index]!,
      ),
    },
    expression: props.poses[index]!.expression,
    easing: "linear" as const,
    bezier: null,
  }));

/** Wrap the corrected keyframes + plants as the pass result. */
export const assemblePlantedFeet = (
  motion: IAutoMovieMotion,
  keyframes: IAutoMovieKeyframe[],
  plants: IAutoMovieFootPlant[],
): IAutoMoviePlantedFeet => ({
  motion: {
    id: motion.id,
    skeleton: motion.skeleton,
    duration: motion.duration,
    loop: motion.loop,
    keyframes,
  },
  plants,
});

/** FK-resolve a pose into a bone → resolved-bone lookup. */
export const resolveBoneMap = (
  skeleton: IAutoMovieSkeleton,
  pose: IAutoMoviePose,
): Map<AutoMovieHumanoidBone, IAutoMovieResolvedBone> =>
  new Map(resolvePose(pose, skeleton).map((bone) => [bone.bone, bone]));

/**
 * The frame's joints with every pinned leg re-solved onto its target: planted
 * legs get their {@link solveLegPlant} articulation, everything else is carried
 * through unchanged.
 */
const plantedJoints = (
  skeleton: IAutoMovieSkeleton,
  pose: IAutoMoviePose,
  legs: readonly IAutoMovieFootLeg[],
  targets: ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>,
): IAutoMovieJointPose[] => {
  let joints = pose.joints;
  for (const leg of legs) {
    const target = targets.get(leg.foot);
    if (target === undefined) continue;
    const solved = solveLegPlant(skeleton, pose, leg, target);
    if (solved === null) continue;
    joints = [
      ...joints.filter((j) => j.bone !== leg.upper && j.bone !== leg.lower),
      solved.upper,
      solved.lower,
    ];
  }
  return joints;
};

/**
 * Two-bone IK for one leg: the thigh + shin articulation that lands `foot` on
 * the pinned world `target`, rooted at the leg's **current posed hip**. The
 * lowering is the shared {@link twoBoneChainArticulation} (the same algebra
 * {@link reachPose} applies to an arm), fed a chain read from the current pose
 * with the leg zeroed, so the correction composes on top of the gait's
 * root/torso motion. Legs use the default clinical basis. Returns `null` for a
 * missing or degenerate leg.
 */
const solveLegPlant = (
  skeleton: IAutoMovieSkeleton,
  pose: IAutoMoviePose,
  leg: IAutoMovieFootLeg,
  target: IAutoMovieVector3,
): { upper: IAutoMovieJointPose; lower: IAutoMovieJointPose } | null => {
  // The leg at rest under the current parent pose: zero its own articulation so
  // the recovered world rotations carry the hip/torso pose but not the leg's.
  const zeroed: IAutoMoviePose = {
    skeleton: pose.skeleton,
    root: pose.root,
    joints: pose.joints.filter(
      (j) => j.bone !== leg.upper && j.bone !== leg.lower,
    ),
  };
  const map = resolveBoneMap(skeleton, zeroed);
  const upper = map.get(leg.upper);
  const lower = map.get(leg.lower);
  const foot = map.get(leg.foot);
  if (upper === undefined || lower === undefined || foot === undefined)
    return null;

  const articulation = twoBoneChainArticulation({
    upper,
    lower,
    end: foot.worldPosition,
    target,
  });
  if (articulation === null) return null;

  return {
    upper: { bone: leg.upper, ...decomposeJointRotation(articulation.upper) },
    lower: { bone: leg.lower, ...decomposeJointRotation(articulation.lower) },
  };
};
