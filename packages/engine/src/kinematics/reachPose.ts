import {
  AutoMovieHumanoidBone,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieRestFrame } from "../rom/restFrame";
import { decomposeJointRotation } from "./decomposeJointRotation";
import { HUMANOID_JOINT_AXES } from "./humanoidJointAxes";
import { resolvePose } from "./resolvePose";
import { twoBoneChainArticulation } from "./twoBoneChainArticulation";

/**
 * Analytic two-bone IK for an arm: the {@link IAutoMoviePose} (upper-arm +
 * forearm articulation) that brings the `side` hand onto `target`, in the
 * skeleton's own model space. This is the harness `reach` verb made concrete:
 * the model says "put your right hand on the lever" and the engine solves the
 * shoulder and elbow that land it there, deterministically, no solver
 * iteration.
 *
 * It reads the arm's segment lengths and rest directions from the skeleton's
 * rest FK, solves the shoulder lift and elbow bend by {@link solveTwoBoneIK},
 * places the elbow off the shoulder→target line (bending away from world-down,
 * the natural solution), then lowers the two world-space bone rotations back
 * into the clinical angles a pose carries via {@link decomposeJointRotation}. An
 * unreachable target extends the arm fully toward it (the hand stops on the
 * reachable shell) rather than failing.
 *
 * Returns `null` if the arm bones are missing or degenerate, a rig that cannot
 * reach.
 *
 * @author Samchon
 */
export const reachPose = (
  skeleton: IAutoMovieSkeleton,
  side: "left" | "right",
  target: IAutoMovieVector3,
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>,
): IAutoMoviePose | null => {
  if (side !== "left" && side !== "right") return null;

  const upperName = side === "left" ? "leftUpperArm" : "rightUpperArm";
  const lowerName = side === "left" ? "leftLowerArm" : "rightLowerArm";
  const handName = side === "left" ? "leftHand" : "rightHand";

  const rest = resolvePose(
    { skeleton: skeleton.id, root: null, joints: [] },
    skeleton,
    HUMANOID_JOINT_AXES,
  );
  const upper = rest.find((b) => b.bone === upperName);
  const lower = rest.find((b) => b.bone === lowerName);
  const hand = rest.find((b) => b.bone === handName);
  if (upper === undefined || lower === undefined || hand === undefined)
    return null;

  const articulation = twoBoneChainArticulation({
    upper,
    lower,
    end: hand.worldPosition,
    target,
  });
  if (articulation === null) return null;

  return {
    skeleton: skeleton.id,
    root: null,
    joints: [
      {
        bone: upperName,
        ...decomposeJointRotation(
          articulation.upper,
          HUMANOID_JOINT_AXES[upperName],
          restFrames?.[upperName],
        ),
      },
      {
        bone: lowerName,
        ...decomposeJointRotation(
          articulation.lower,
          HUMANOID_JOINT_AXES[lowerName],
          restFrames?.[lowerName],
        ),
      },
    ],
  };
};
