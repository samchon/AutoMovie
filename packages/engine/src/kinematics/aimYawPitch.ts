import { IautomovieVector3, IautomovieYawPitch } from "@automovie/interface";

/**
 * The **yaw and pitch** (degrees) that aim from `from` at `to`, expressed in a
 * frame facing `facingDeg` about +Y ??the angles a head / eye / camera turns
 * through to look at a target. The world direction is rotated into the actor's
 * local frame (undoing its facing), then:
 *
 * - **yaw** = `atan2(localX, localZ)` ??the turn off straight-ahead (0 = dead
 *   ahead, +90 = the actor's left, matching the direction-target convention);
 * - **pitch** = `atan2(localY, horizontal)` ??the tilt up (+) / down (??.
 *
 * Returns `{ yawDeg: 0, pitchDeg: 0 }` for a degenerate zero-length aim (the
 * target sits on `from`). The caller maps yaw/pitch onto a rig's joints (a
 * head's twist + flexion, a camera's pan + tilt).
 *
 * @author Samchon
 */
export const aimYawPitch = (
  from: IautomovieVector3,
  to: IautomovieVector3,
  facingDeg: number,
): IautomovieYawPitch => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  if (dx === 0 && dy === 0 && dz === 0) return { yawDeg: 0, pitchDeg: 0 };

  const f = (facingDeg * Math.PI) / 180;
  const cos = Math.cos(f);
  const sin = Math.sin(f);
  // rotate the world direction by ?뭚acing into the actor's local frame
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  const horizontal = Math.hypot(localX, localZ);
  return {
    yawDeg: (Math.atan2(localX, localZ) * 180) / Math.PI,
    pitchDeg: (Math.atan2(dy, horizontal) * 180) / Math.PI,
  };
};
