import { IautomovieQuaternion, IautomovieVector3 } from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";

/**
 * The shortest-arc rotation that turns the unit vector `from` onto `to` ??the
 * core of an **aim / look-at** driver (a head or eye whose forward axis tracks
 * a target, a camera that follows its subject). Feed `from` = the bone's rest
 * forward axis and `to` = `target ??bonePosition` and the returned quaternion
 * orients the bone at the target.
 *
 * Degenerate cases are handled: already-aligned returns identity; antiparallel
 * returns a 180째 turn about an arbitrary perpendicular axis (so it never
 * divides by a zero cross product).
 *
 * @author Samchon
 */
export const aimRotation = (
  from: IautomovieVector3,
  to: IautomovieVector3,
): IautomovieQuaternion => {
  const a = Vector3.normalize(from);
  const b = Vector3.normalize(to);
  const d = Vector3.dot(a, b);
  if (d > 0.999999) return { x: 0, y: 0, z: 0, w: 1 };
  if (d < -0.999999) {
    let axis = Vector3.cross(a, { x: 1, y: 0, z: 0 });
    if (Vector3.length(axis) < 1e-6)
      axis = Vector3.cross(a, { x: 0, y: 1, z: 0 });
    return Quaternion.fromAxisAngle(Vector3.normalize(axis), 180);
  }
  return Quaternion.fromAxisAngle(
    Vector3.normalize(Vector3.cross(a, b)),
    (Math.acos(d) * 180) / Math.PI,
  );
};
