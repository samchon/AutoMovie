import { IAutoFilmJointAxes, resolvePose } from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmPose,
  IAutoFilmSkeleton,
} from "@autofilm/interface";

import { IAutoFilmModelObject, applyTransform } from "./buildModel";

/**
 * Apply a {@link IAutoFilmPose} to a built model by running the engine's forward
 * kinematics and writing each bone's local rotation onto the corresponding
 * `THREE.Bone`. The pose's root transform (if any) is applied to the model
 * root.
 *
 * The engine owns the math (semantic angles → quaternions), so the viewer only
 * copies results onto `three.js` objects — keeping rendering a thin, swappable
 * layer over the deterministic core.
 *
 * @author Samchon
 */
export const applyPose = (
  target: IAutoFilmModelObject,
  pose: IAutoFilmPose,
  skeleton: IAutoFilmSkeleton,
  jointAxes?: Partial<Record<AutoFilmHumanoidBone, IAutoFilmJointAxes>>,
): void => {
  for (const r of resolvePose(pose, skeleton, jointAxes)) {
    const bone = target.bones.get(r.bone);
    if (bone !== undefined)
      bone.quaternion.set(
        r.localRotation.x,
        r.localRotation.y,
        r.localRotation.z,
        r.localRotation.w,
      );
  }
  if (pose.root !== null) applyTransform(target.object, pose.root);
};
