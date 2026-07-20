import {
  AutoMovieHumanoidBone,
  IAutoMovieAttachment,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { IAutoMovieJointAxes } from "./jointToQuaternion";
import { resolvePose } from "./resolvePose";

/**
 * Resolve the **world transform of a child model's root** rigidly coupled to a
 * bone of a posed parent skeleton, the cross-skeleton joint behind a rider on a
 * horse, a sword in a hand, a passenger in a cart.
 *
 * It runs forward kinematics on the parent ({@link resolvePose}), reads the
 * attachment bone's world position + orientation, and composes the
 * {@link IAutoMovieAttachment} offset into that frame:
 *
 * - `translation = boneWorldPos + boneWorldRot · offset.translation`
 * - `rotation = boneWorldRot ∘ offset.rotation`
 *
 * So the child inherits both where the bone is and how it is turned: as a horse
 * rears and its chest pitches back, the seat (and the rider locked to it) pitch
 * with it, exactly as a physics fixed-joint would carry one body on another.
 * Feed the returned transform to the child as its root each frame.
 *
 * Throws if the skeleton has no such bone (a mis-wired attachment is a bug, not
 * a silently-skipped frame).
 *
 * `restFrames` must match the renderer's pose path when the parent motion is
 * authored in clinical space; otherwise a prop would ride raw rig-space FK
 * while the visible parent is read through its clinical frame.
 *
 * @author Samchon
 */
export const resolveAttachment = (
  parentPose: IAutoMoviePose,
  parentSkeleton: IAutoMovieSkeleton,
  attachment: IAutoMovieAttachment,
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>,
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>,
): IAutoMovieTransform => {
  const resolved = resolvePose(
    parentPose,
    parentSkeleton,
    jointAxes,
    restFrames,
  );
  const seat = resolved.find((r) => r.bone === attachment.parentBone);
  if (seat === undefined)
    throw new Error(
      `resolveAttachment: parent bone "${attachment.parentBone}" is not in the skeleton`,
    );

  const off = attachment.offset;
  return {
    translation: Vector3.add(
      seat.worldPosition,
      Quaternion.rotateVector(seat.worldRotation, off.translation),
    ),
    rotation: Quaternion.multiply(seat.worldRotation, off.rotation),
    scale: off.scale,
  };
};
