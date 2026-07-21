import {
  AutoMovieHumanoidBone,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import { HUMANOID_JOINT_AXES } from "./humanoidJointAxes";
import { IAutoMovieJointAxes } from "./jointToQuaternion";

/** Why an arm chain cannot be solved by the analytic arm IK. */
export interface IAutoMovieArmChainFault {
  /** Which arm the fault was found on. */
  side: "left" | "right";

  /** The mid joint whose hinge cannot bend the chain. */
  bone: AutoMovieHumanoidBone;

  /**
   * The fault in the engine's own words, phrased so a correction round can act
   * on it: which bone, what is parallel to what, and what that costs.
   */
  reason: string;
}

/**
 * Sine of the angle below which a hinge counts as parallel to the segment it
 * drives. The engine's other geometric degeneracy guards (zero-length segment,
 * target on the chain root, bend-plane fallback) all use `1e-6`, and this is
 * the same kind of question asked about an angle rather than a length. A rig
 * whose elbow is merely CLOSE to parallel still solves: it can bend, just
 * weakly, and refusing it would be the engine deciding how much articulation is
 * worth having.
 */
const PARALLEL_SINE = 1e-6;

/**
 * Whether an arm chain can be articulated at all by the analytic arm IK,
 * decided from the rig rather than from a convention's name.
 *
 * `HUMANOID_JOINT_AXES` maps the arm's `flexion` onto local **+Y** because the
 * canonical humanoid rests in the VRM T-pose, arms out along local ±X. That
 * table is applied unconditionally by every arm computation on the surface, and
 * on a rig that rests otherwise it can name an axis the bone cannot use: when
 * the elbow's flexion axis lies along the forearm's own rest direction, elbow
 * flexion is a **roll**, so the hand does not move at all and the arm is a
 * rigid stick. The chain then has one reachable radius instead of a shell, and
 * every downstream answer about it is wrong while every validator stays green
 * (#1346).
 *
 * The test is first-principles rather than a T-pose sniff, which matters
 * because the humanoid bone enum is the only vocabulary the surface has: a
 * retargeted quadruped's FRONT legs ride the arm chains and legitimately rest
 * along −Y. Such a rig is refused only where an arm-IK question is actually
 * asked of it, never at authoring time, so a quadruped that never reaches stays
 * free.
 *
 * Returns `null` when the chain is solvable, and `null` for a chain whose bones
 * are missing entirely (that is {@link reachPose}'s own "no measurable arm"
 * answer, a different fact from a rig whose elbow cannot bend).
 *
 * @author Samchon
 */
export const armChainFault = (
  skeleton: IAutoMovieSkeleton,
  side: "left" | "right",
  jointAxes: Partial<
    Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>
  > = HUMANOID_JOINT_AXES,
): IAutoMovieArmChainFault | null => {
  const lowerName: AutoMovieHumanoidBone =
    side === "left" ? "leftLowerArm" : "rightLowerArm";
  const handName: AutoMovieHumanoidBone =
    side === "left" ? "leftHand" : "rightHand";

  const hand = skeleton.bones.find((bone) => bone.bone === handName);
  if (hand === undefined) return null;

  // The mid joint's articulation is applied INSIDE the bone's rest rotation
  // (`worldRot = parentWorld · rest · articulation`), so it rotates the hand's
  // rest offset directly: both vectors are read in that one bone-local frame.
  const fore = hand.rest.translation;
  const foreLength = Vector3.length(fore);
  if (foreLength < 1e-6) return null;

  const flexion = jointAxes[lowerName]?.flexion;
  if (flexion === undefined) return null;
  const hingeLength = Vector3.length(flexion);
  if (hingeLength < 1e-6) return null;

  const sine = Vector3.length(
    Vector3.cross(
      Vector3.scale(flexion, 1 / hingeLength),
      Vector3.scale(fore, 1 / foreLength),
    ),
  );
  if (sine >= PARALLEL_SINE) return null;

  return {
    side,
    bone: lowerName,
    reason:
      `${lowerName} cannot bend this arm: its flexion axis (${axisText(flexion)}) is parallel to the ` +
      `forearm's own rest direction (${axisText(fore)}), so elbow flexion rolls the forearm along its ` +
      `length and never moves the hand. The humanoid arm axes place flexion off the bone's length for a ` +
      `rig resting in the canonical T-pose (arms along local ±X); an arm resting ALONG its flexion axis ` +
      `has no reach shell, only a fixed radius, so no arm IK pose can be solved for it.`,
  };
};

const axisText = (axis: { x: number; y: number; z: number }): string =>
  `${trim(axis.x)}, ${trim(axis.y)}, ${trim(axis.z)}`;

/** Six significant digits, trailing zeros dropped: a readable, stable number. */
const trim = (value: number): string => String(Number(value.toPrecision(6)));
