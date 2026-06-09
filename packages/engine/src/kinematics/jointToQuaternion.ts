import {
  IAutoFilmJointPose,
  IAutoFilmQuaternion,
  IAutoFilmVector3,
} from "@autofilm/interface";

import { Quaternion } from "../math/Quaternion";

/**
 * The bone-local axes the three clinical angles rotate about. Lets a rig whose
 * bone frames are not aligned to the default clinical planes (e.g. a T-pose arm
 * pointing along its local X) declare which local axis flexion / abduction /
 * twist each swing, so "flexion" stays anatomically sagittal instead of rolling
 * the bone along its length.
 */
export interface IAutoFilmJointAxes {
  /** Axis `flexion` rotates about (sagittal). */
  flexion: IAutoFilmVector3;
  /** Axis `abduction` rotates about (frontal). */
  abduction: IAutoFilmVector3;
  /** Axis `twist` rotates about (the bone's long axis). */
  twist: IAutoFilmVector3;
}

/** The default clinical basis: flexion→X, abduction→Z, twist→Y. */
export const DEFAULT_JOINT_AXES: IAutoFilmJointAxes = {
  flexion: { x: 1, y: 0, z: 0 },
  abduction: { x: 0, y: 0, z: 1 },
  twist: { x: 0, y: 1, z: 0 },
};

/**
 * Convert a joint's semantic clinical angles (flexion / abduction / twist) into
 * a single bone-local rotation quaternion.
 *
 * **Axis convention** (bone-local frame, applied in this fixed order): flexion
 * about {@link IAutoFilmJointAxes.flexion} (default local **X**, sagittal),
 * abduction about `abduction` (default **Z**, frontal), twist about `twist`
 * (default **Y**, the bone's long axis). Composition order is twist ∘ abduction
 * ∘ flexion — flexion first in the bone's own frame, then abduction, then axial
 * twist:
 *
 *     q = qTwist * qAbduction * qFlexion;
 *
 * `axes` overrides the default basis per bone so a rig keeps flexion
 * anatomically correct regardless of how its rest frame is oriented (a T-pose
 * arm wants flexion about Y, not its length axis X). Omit it for the default
 * clinical basis, which is consistent and round-trippable.
 *
 * A `null` angle means "no rotation on that axis" and contributes identity.
 *
 * @author Samchon
 */
export const jointToQuaternion = (
  joint: Pick<IAutoFilmJointPose, "flexion" | "abduction" | "twist">,
  axes: IAutoFilmJointAxes = DEFAULT_JOINT_AXES,
): IAutoFilmQuaternion => {
  const qFlexion = Quaternion.fromAxisAngle(axes.flexion, joint.flexion ?? 0);
  const qAbduction = Quaternion.fromAxisAngle(
    axes.abduction,
    joint.abduction ?? 0,
  );
  const qTwist = Quaternion.fromAxisAngle(axes.twist, joint.twist ?? 0);
  return Quaternion.multiply(qTwist, Quaternion.multiply(qAbduction, qFlexion));
};
