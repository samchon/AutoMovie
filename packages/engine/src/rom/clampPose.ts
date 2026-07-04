import {
  IAutoMovieAngleRange,
  IAutoMovieJointConstraint,
  IAutoMovieJointPose,
  IAutoMoviePose,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { getConstraint } from "./humanoidRom";
import { swingConeScale } from "./swingCone";

const clampAxis = (
  angle: number | null,
  allowed: IAutoMovieAngleRange | null,
): number | null => {
  if (angle === null) return null;
  if (allowed === null) return 0; // immobile axis: forced back to neutral
  const finiteAngle = Number.isFinite(angle) ? angle : 0;
  return finiteAngle < allowed.min
    ? allowed.min
    : finiteAngle > allowed.max
      ? allowed.max
      : finiteAngle;
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
  joint: IAutoMovieJointPose,
  constraint: IAutoMovieJointConstraint,
): IAutoMovieJointPose => {
  const flexion = clampAxis(joint.flexion, constraint.flexion);
  const abduction = clampAxis(joint.abduction, constraint.abduction);
  const twist = clampAxis(joint.twist, constraint.twist);
  // ball-joint swing cone: pull a corner pose straight back onto the cone,
  // preserving the flexion:abduction ratio (the swing direction)
  if (constraint.swingDeg != null && flexion !== null && abduction !== null) {
    const k = swingConeScale(flexion, abduction, constraint.swingDeg);
    return {
      bone: joint.bone,
      flexion: flexion * k,
      abduction: abduction * k,
      twist,
    };
  }
  return { bone: joint.bone, flexion, abduction, twist };
};

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
  pose: IAutoMoviePose,
  skeleton: IAutoMovieSkeleton,
): IAutoMoviePose => ({
  skeleton: pose.skeleton,
  root: pose.root,
  joints: pose.joints.map((joint) => {
    const bone = skeleton.bones.find((b) => b.bone === joint.bone);
    const constraint = getConstraint(joint.bone, bone?.constraint ?? null);
    return constraint === null ? joint : clampJointRom(joint, constraint);
  }),
});
