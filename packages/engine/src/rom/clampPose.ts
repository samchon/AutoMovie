import {
  IAutoMovieAngleRange,
  IAutoMovieJointConstraint,
  IAutoMovieJointPose,
  IAutoMoviePose,
  IAutoMovieSkeleton,
} from "@automovie/interface";

import { getConstraint } from "./humanoidRom";
import { swingConeBlend } from "./swingCone";

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
  // Ball-joint swing cone: pull a corner pose back onto the cone. The cone is a
  // COUPLING between the two axes, not a per-axis check, so a resting (`null`)
  // axis is not exempt from it — it contributes its actual rotation, 0, exactly
  // as the renderer reads it (`jointToQuaternion`'s `?? 0`). Gating the cone on
  // both axes being non-null let `{flexion:150, abduction:null}` keep an angle
  // its identical twin `{flexion:150, abduction:0}` was clamped out of (#1245).
  if (typeof constraint.swingDeg === "number") {
    const f = flexion ?? 0;
    const a = abduction ?? 0;
    // Pull toward the box point nearest neutral rather than toward neutral
    // itself: for a box that excludes neutral, shrinking toward the origin
    // leaves the box (#1245). A resting axis anchors at its own rest, 0.
    const anchorF = flexion === null ? 0 : nearestNeutral(constraint.flexion);
    const anchorA =
      abduction === null ? 0 : nearestNeutral(constraint.abduction);
    const t = swingConeBlend(f, a, anchorF, anchorA, constraint.swingDeg);
    const blend = (value: number, anchor: number): number =>
      anchor + (value - anchor) * t;
    return {
      bone: joint.bone,
      // A resting axis stays resting: blending 0 toward its own 0 rest is 0.
      flexion: flexion === null ? null : blend(f, anchorF),
      abduction: abduction === null ? null : blend(a, anchorA),
      twist,
    };
  }
  return { bone: joint.bone, flexion, abduction, twist };
};

/**
 * The point of `allowed` closest to neutral — neutral itself when the range
 * brackets it, else the nearer bound. This is the swing cone's pull target: the
 * joint's most-retracted reachable articulation on that axis.
 */
const nearestNeutral = (allowed: IAutoMovieAngleRange | null): number =>
  allowed === null
    ? 0
    : allowed.min > 0
      ? allowed.min
      : allowed.max < 0
        ? allowed.max
        : 0;

/**
 * Clamp one joint against the skeleton's effective ROM: the bone's own
 * `constraint` override when it carries one, otherwise the default humanoid
 * table — the `target-override-then-default-humanoid` precedence
 * {@link retargetHumanoidMotion} names as its ROM policy. A bone with neither
 * passes through unchanged.
 *
 * Exposed separately from {@link clampPose} because a solver that rewrites only
 * the joints it derived (a retarget contact correction) must not clamp the
 * authored joints it left alone.
 *
 * @author Samchon
 */
export const clampJointToSkeleton = (
  joint: IAutoMovieJointPose,
  skeleton: IAutoMovieSkeleton,
): IAutoMovieJointPose => {
  const bone = skeleton.bones.find((b) => b.bone === joint.bone);
  const constraint = getConstraint(joint.bone, bone?.constraint ?? null);
  return constraint === null ? joint : clampJointRom(joint, constraint);
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
  joints: pose.joints.map((joint) => clampJointToSkeleton(joint, skeleton)),
});
