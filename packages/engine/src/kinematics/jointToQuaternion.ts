import {
  IAutoMovieJointPose,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { IAutoMovieRestFrame, toRigAngle } from "../rom/restFrame";

const JOINT_AXES = ["flexion", "abduction", "twist"] as const;
const VECTOR_AXES = ["x", "y", "z"] as const;

/**
 * The bone-local axes the three clinical angles rotate about. Lets a rig whose
 * bone frames are not aligned to the default clinical planes (e.g. a T-pose arm
 * pointing along its local X) declare which local axis flexion / abduction /
 * twist each swing, so "flexion" stays anatomically sagittal instead of rolling
 * the bone along its length.
 */
export interface IAutoMovieJointAxes {
  /** Axis `flexion` rotates about (sagittal). */
  flexion: IAutoMovieVector3;
  /** Axis `abduction` rotates about (frontal). */
  abduction: IAutoMovieVector3;
  /** Axis `twist` rotates about (the bone's long axis). */
  twist: IAutoMovieVector3;
}

/** The default clinical basis: flexion→X, abduction→Z, twist→Y. */
export const DEFAULT_JOINT_AXES: IAutoMovieJointAxes = {
  flexion: { x: 1, y: 0, z: 0 },
  abduction: { x: 0, y: 0, z: 1 },
  twist: { x: 0, y: 1, z: 0 },
};

const readAngle = (
  joint: Pick<IAutoMovieJointPose, "flexion" | "abduction" | "twist">,
  axis: (typeof JOINT_AXES)[number],
  frame: IAutoMovieRestFrame[(typeof JOINT_AXES)[number]] | undefined,
): number => {
  const value = joint[axis];
  if (value !== null && !Number.isFinite(value))
    throw new Error(
      `jointToQuaternion ${axis} must be finite or null, but was ${value}`,
    );
  return toRigAngle(value, frame) ?? 0;
};

const assertFiniteAxes = (axes: IAutoMovieJointAxes): void => {
  for (const jointAxis of JOINT_AXES)
    for (const vectorAxis of VECTOR_AXES) {
      const value = axes[jointAxis][vectorAxis];
      if (!Number.isFinite(value))
        throw new Error(
          `jointToQuaternion axes.${jointAxis}.${vectorAxis} must be finite, but was ${value}`,
        );
    }
};

/**
 * Convert a joint's semantic clinical angles (flexion / abduction / twist) into
 * a single bone-local rotation quaternion.
 *
 * **Axis convention** (bone-local frame, applied in this fixed order): flexion
 * about {@link IAutoMovieJointAxes.flexion} (default local **X**, sagittal),
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
 * When a `frame` ({@link IAutoMovieRestFrame}) is given, the joint's angles are
 * read as **clinical** and mapped into the rig's rest-relative space first (`r
 * = (clinical − neutral) / sign`, per {@link toRigAngle}) — so a pose can be
 * authored in one intuitive clinical convention (e.g. +abduction raises either
 * arm) and the per-side rest frame reconciles it. Omit it for angles already in
 * the rig's own space.
 *
 * @author Samchon
 */
export const jointToQuaternion = (
  joint: Pick<IAutoMovieJointPose, "flexion" | "abduction" | "twist">,
  axes: IAutoMovieJointAxes = DEFAULT_JOINT_AXES,
  frame?: IAutoMovieRestFrame,
): IAutoMovieQuaternion => {
  assertFiniteAxes(axes);
  const qFlexion = Quaternion.fromAxisAngle(
    axes.flexion,
    readAngle(joint, "flexion", frame?.flexion),
  );
  const qAbduction = Quaternion.fromAxisAngle(
    axes.abduction,
    readAngle(joint, "abduction", frame?.abduction),
  );
  const qTwist = Quaternion.fromAxisAngle(
    axes.twist,
    readAngle(joint, "twist", frame?.twist),
  );
  return Quaternion.multiply(qTwist, Quaternion.multiply(qAbduction, qFlexion));
};
