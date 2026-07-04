import { IAutoMovieQuaternion } from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { IAutoMovieRestFrame, toClinicalAngle } from "../rom/restFrame";
import { DEFAULT_JOINT_AXES, IAutoMovieJointAxes } from "./jointToQuaternion";

const RAD2DEG = 180 / Math.PI;

/**
 * The inverse of {@link jointToQuaternion}: recover the clinical angles (flexion
 * / abduction / twist, degrees) from a bone-local rotation, given the same axis
 * basis. This is what an IK solver needs — it computes the bone rotations that
 * reach a goal as quaternions, then lowers them back into the
 * flexion/abduction/twist a pose carries.
 *
 * The extraction diagonalises the fixed composition `q = qTwist · qAbduction ·
 * qFlexion`. Changing basis by `M = [flexAxis | abdAxis | twistAxis]` turns it
 * into the standard `Rz(twist)·Ry(abduction)·Rx(flexion)` sequence, whose
 * closed-form ZYX extraction is well known — computed here as dot products of
 * the axes with the rotated axes, so no matrix is built. Gimbal lock (abduction
 * ≈ ±90°, the arm straight up or down) collapses flexion into twist; the
 * extraction pins flexion to 0 and folds the freedom into twist, which still
 * reconstructs the same rotation.
 *
 * A **left-handed** axis triple (the default clinical basis is one: `flexAxis ×
 * abdAxis = −twistAxis`) would flip the twist sense; the extraction detects the
 * handedness and corrects it, so `jointToQuaternion(decompose(q))` round-trips
 * for any orthonormal basis, right- or left-handed.
 *
 * A `frame` ({@link IAutoMovieRestFrame}) lifts the recovered rest-relative
 * angles into **clinical** ones (`clinical = sign · r + neutral`), the inverse
 * of `jointToQuaternion`'s `frame` map — so `jointToQuaternion(decompose(q,
 * axes, f), axes, f)` still round-trips.
 *
 * @author Samchon
 */
export const decomposeJointRotation = (
  q: IAutoMovieQuaternion,
  axes: IAutoMovieJointAxes = DEFAULT_JOINT_AXES,
  frame?: IAutoMovieRestFrame,
): { flexion: number; abduction: number; twist: number } => {
  // Lift a rig-relative extraction into clinical angles (the inverse of
  // jointToQuaternion's `frame` map); the identity when no frame is given.
  const lift = (rig: {
    flexion: number;
    abduction: number;
    twist: number;
  }): { flexion: number; abduction: number; twist: number } => ({
    // toClinicalAngle only returns null for a null input; these are numbers.
    flexion: toClinicalAngle(rig.flexion, frame?.flexion)!,
    abduction: toClinicalAngle(rig.abduction, frame?.abduction)!,
    twist: toClinicalAngle(rig.twist, frame?.twist)!,
  });
  // Right-handedness of the basis: +1 when flex × abd = +twist. A left-handed
  // triple is made right-handed by extracting against −twist, then negating the
  // recovered twist (a rotation about −t by θ is one about t by −θ).
  const handed =
    Vector3.dot(axes.twist, Vector3.cross(axes.flexion, axes.abduction)) >= 0
      ? 1
      : -1;
  const twistAxis = Vector3.scale(axes.twist, handed);

  const Rf = Quaternion.rotateVector(q, axes.flexion);
  const Ra = Quaternion.rotateVector(q, axes.abduction);
  const Rt = Quaternion.rotateVector(q, twistAxis);

  // Entries of R' = Mᵀ R M (M = [flex|abd|twist]): R'[i][j] = axisᵢ · (R axisⱼ).
  const m00 = Vector3.dot(axes.flexion, Rf);
  const m10 = Vector3.dot(axes.abduction, Rf);
  const m20 = Vector3.dot(twistAxis, Rf);
  const m21 = Vector3.dot(twistAxis, Ra);
  const m22 = Vector3.dot(twistAxis, Rt);

  if (m20 < -0.999999 || m20 > 0.999999) {
    // Gimbal: abduction = ±90°, flexion folds into twist. Pin flexion = 0.
    const m01 = Vector3.dot(axes.flexion, Ra);
    const m11 = Vector3.dot(axes.abduction, Ra);
    // Both gimbals leave only (twist ± flexion) determined; with flexion pinned
    // to 0, twist = −atan2(R'[0][1], R'[1][1]) reconstructs the rotation.
    const abduction = m20 < 0 ? 90 : -90;
    const twist = -Math.atan2(m01, m11) * RAD2DEG;
    return lift({ flexion: 0, abduction, twist: handed * twist });
  }

  return lift({
    flexion: Math.atan2(m21, m22) * RAD2DEG,
    abduction: Math.asin(Math.max(-1, Math.min(1, -m20))) * RAD2DEG,
    twist: handed * Math.atan2(m10, m00) * RAD2DEG,
  });
};
