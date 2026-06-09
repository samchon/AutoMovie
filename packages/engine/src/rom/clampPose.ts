import {
  IAutoFilmAngleRange,
  IAutoFilmJointConstraint,
  IAutoFilmJointPose,
  IAutoFilmPose,
  IAutoFilmSkeleton,
} from "@autofilm/interface";

import { getConstraint } from "./humanoidRom";

const clampAxis = (
  angle: number | null,
  allowed: IAutoFilmAngleRange | null,
): number | null => {
  if (angle === null) return null;
  if (allowed === null) return 0; // immobile axis: forced back to neutral
  return angle < allowed.min
    ? allowed.min
    : angle > allowed.max
      ? allowed.max
      : angle;
};

/**
 * Clamp one joint's articulation into its anatomical range of motion — the
 * **enforce** face of {@link validateJointRom}'s **detect** face (the core
 * model's `ClampOutcome`: clamp and validate are one calculation).
 *
 * Each axis is pulled to the nearest bound of its `[min, max]`; an axis the
 * constraint marks `null` (the joint cannot move that way) is forced to `0`,
 * just as a physics hinge refuses the disallowed degrees of freedom. A `null`
 * angle (axis left at rest) stays `null`.
 *
 * @author Samchon
 */
export const clampJointRom = (
  joint: IAutoFilmJointPose,
  constraint: IAutoFilmJointConstraint,
): IAutoFilmJointPose => ({
  bone: joint.bone,
  flexion: clampAxis(joint.flexion, constraint.flexion),
  abduction: clampAxis(joint.abduction, constraint.abduction),
  twist: clampAxis(joint.twist, constraint.twist),
});

/**
 * Clamp every joint of a pose into its skeleton's ROM, returning a new pose
 * (the root transform is untouched). A joint whose bone has no constraint —
 * neither a per-bone override nor a default-table entry — passes through
 * unchanged.
 *
 * This is what makes a joint behave like a limited physics joint: feed any pose
 * (e.g. raw LLM output) through `clampPose` and it can no longer exceed each
 * joint's gamut, the same bounds {@link validateJointRom} reports `// ❌` for.
 *
 * @author Samchon
 */
export const clampPose = (
  pose: IAutoFilmPose,
  skeleton: IAutoFilmSkeleton,
): IAutoFilmPose => ({
  skeleton: pose.skeleton,
  root: pose.root,
  joints: pose.joints.map((joint) => {
    const bone = skeleton.bones.find((b) => b.bone === joint.bone);
    const constraint = getConstraint(joint.bone, bone?.constraint ?? null);
    return constraint === null ? joint : clampJointRom(joint, constraint);
  }),
});
