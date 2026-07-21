import {
  AutoMovieHumanoidBone,
  IAutoMoviePose,
  IAutoMovieQuaternion,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { getConstraint } from "../rom/humanoidRom";
import { HUMANOID_REST_FRAME, IAutoMovieRestFrame } from "../rom/restFrame";
import { armChainFault } from "./armChainFault";
import { decomposeJointRotation } from "./decomposeJointRotation";
import {
  clinicalDeviation,
  hingedArmArticulation,
  jointRomOvershoot,
} from "./hingedArmArticulation";
import { HUMANOID_JOINT_AXES } from "./humanoidJointAxes";
import { resolvePose } from "./resolvePose";

/** A joint whose three clinical angles are all known numbers. */
interface IAutoMovieClinicalJoint {
  bone: AutoMovieHumanoidBone;
  flexion: number;
  abduction: number;
  twist: number;
}

/**
 * Analytic two-bone IK for an arm: the {@link IAutoMoviePose} (upper-arm +
 * forearm articulation) that brings the `side` hand onto `target`, in the
 * skeleton's own model space. This is the harness `reach` verb made concrete:
 * the model says "put your right hand on the lever" and the engine solves the
 * shoulder and elbow that land it there, deterministically, no solver
 * iteration.
 *
 * It reads the arm's segment lengths and rest directions from the skeleton's
 * rest FK, then solves the chain with {@link hingedArmArticulation}: the elbow
 * turns only about its own flexion axis (so its abduction and twist are zero by
 * construction, which is exactly what an elbow's immobile axes require), and
 * the shoulder spends the chain's exact swivel freedom on staying inside the
 * rig's declared range of motion. An unreachable target extends the arm fully
 * toward it (the hand stops on the reachable shell) rather than failing.
 *
 * **The angles come out CLINICAL.** {@link IAutoMovieJointPose} defines itself
 * as semantic clinical angles precisely so a generated angle can be checked
 * against the ROM table by a direct per-axis comparison, which is what
 * {@link validatePose} does. The clinical axes and the rest frame are two halves
 * of ONE convention, so this function owns both: it applies
 * {@link HUMANOID_JOINT_AXES} unconditionally, and therefore defaults
 * `restFrames` to the matching {@link HUMANOID_REST_FRAME}. Leaving the frame to
 * the caller made `getReach` (which passed it) and `perform`'s arm verbs (which
 * usually did not) answer the same rig in two different spaces, and the
 * rest-relative one was then judged against the clinical table off by the
 * shoulder's whole 90-degree rest abduction (#1346). Pass an explicit table for
 * a rig with its own rest convention, or `{}` for raw rig-space angles.
 *
 * Returns `null` if the arm bones are missing, the chain is geometrically
 * degenerate, or the rig's elbow cannot bend the arm at all under these axes
 * ({@link armChainFault}): a rig that cannot reach.
 *
 * @author Samchon
 */
export const reachPose = (
  skeleton: IAutoMovieSkeleton,
  side: "left" | "right",
  target: IAutoMovieVector3,
  restFrames: Partial<
    Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>
  > = HUMANOID_REST_FRAME,
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

  // A rig whose elbow flexion is a roll has no reach shell to solve against.
  // Refused HERE, at the point of use, never at authoring time: the humanoid
  // bone enum is the only vocabulary the surface has, so a retargeted
  // quadruped's front legs legitimately ride the arm chains (#1346).
  if (armChainFault(skeleton, side) !== null) return null;

  // The FK walk above already reached all three bones, so they are declared.
  const byBone = new Map(skeleton.bones.map((b) => [b.bone, b]));
  const upperBone = byBone.get(upperName)!;
  const lowerBone = byBone.get(lowerName)!;
  const handBone = byBone.get(handName)!;

  // Every arm bone is present in the humanoid axis table by construction.
  const upperAxes = HUMANOID_JOINT_AXES[upperName]!;
  const lowerAxes = HUMANOID_JOINT_AXES[lowerName]!;
  const upperConstraint = getConstraint(upperName, upperBone.constraint);
  const lowerConstraint = getConstraint(lowerName, lowerBone.constraint);

  const jointsOf = (
    upperDelta: IAutoMovieQuaternion,
    lowerDelta: IAutoMovieQuaternion,
  ): [IAutoMovieClinicalJoint, IAutoMovieClinicalJoint] => [
    {
      bone: upperName,
      ...decomposeJointRotation(upperDelta, upperAxes, restFrames[upperName]),
    },
    {
      bone: lowerName,
      ...decomposeJointRotation(lowerDelta, lowerAxes, restFrames[lowerName]),
    },
  ];

  const articulation = hingedArmArticulation({
    upper,
    midOffset: lowerBone.rest.translation,
    midRest: lowerBone.rest.rotation,
    endOffset: handBone.rest.translation,
    hinge: lowerAxes.flexion,
    target,
    // Scored through the same clinical decomposition the result is reported
    // in, so the candidate the solver picks is the candidate `validatePose`
    // will grade. A solver that graded itself by a kinder rule than its gate
    // would just relocate the disagreement this issue is about.
    score: (upperDelta, lowerDelta) => {
      const [upperJoint, lowerJoint] = jointsOf(upperDelta, lowerDelta);
      return {
        overshoot:
          jointRomOvershoot(upperJoint, upperConstraint) +
          jointRomOvershoot(lowerJoint, lowerConstraint),
        deviation:
          clinicalDeviation(upperJoint) + clinicalDeviation(lowerJoint),
      };
    },
  });
  if (articulation === null) return null;

  return {
    skeleton: skeleton.id,
    root: null,
    joints: jointsOf(articulation.upper, articulation.lower),
  };
};
