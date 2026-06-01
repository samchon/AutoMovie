import { IMoticaJointPose, IMoticaQuaternion } from "@motica/interface";

import { Quaternion } from "../math/Quaternion";

/**
 * Convert a joint's semantic clinical angles (flexion / abduction / twist) into
 * a single bone-local rotation quaternion.
 *
 * **Axis convention** (bone-local frame, applied in this fixed order):
 *
 * - `flexion` rotates about the local **X** axis (sagittal plane),
 * - `abduction` rotates about the local **Z** axis (frontal plane),
 * - `twist` rotates about the local **Y** axis (the bone's long axis).
 *
 * Composition order is twist ∘ abduction ∘ flexion — i.e. flexion is applied
 * first in the bone's own frame, then abduction, then axial twist:
 *
 *     q = qTwist * qAbduction * qFlexion;
 *
 * This is a deliberate, documented baseline. Real rigs vary in how each bone's
 * local axes are oriented relative to these clinical planes; per-bone axis
 * remapping is a future refinement, but the convention here is consistent and
 * round-trippable, which is what the validation and rendering paths need.
 *
 * A `null` axis means "no rotation on that axis" and contributes identity.
 *
 * @author Samchon
 */
export const jointToQuaternion = (
  joint: Pick<IMoticaJointPose, "flexion" | "abduction" | "twist">,
): IMoticaQuaternion => {
  const qFlexion = Quaternion.fromAxisAngle(
    { x: 1, y: 0, z: 0 },
    joint.flexion ?? 0,
  );
  const qAbduction = Quaternion.fromAxisAngle(
    { x: 0, y: 0, z: 1 },
    joint.abduction ?? 0,
  );
  const qTwist = Quaternion.fromAxisAngle(
    { x: 0, y: 1, z: 0 },
    joint.twist ?? 0,
  );
  return Quaternion.multiply(qTwist, Quaternion.multiply(qAbduction, qFlexion));
};
