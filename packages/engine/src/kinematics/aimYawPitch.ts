import { IAutoMovieVector3, IAutoMovieYawPitch } from "@automovie/interface";

const VECTOR_AXES = ["x", "y", "z"] as const;

/**
 * The **yaw and pitch** (degrees) that aim from `from` at `to`, expressed in a
 * frame facing `facingDeg` about +Y, the angles a head / eye / camera turns
 * through to look at a target. The world direction is rotated into the actor's
 * local frame (undoing its facing), then:
 *
 * - **yaw** = `atan2(localX, localZ)`: the turn off straight-ahead (0 = dead
 *   ahead, +90 = the actor's left, matching the direction-target convention);
 * - **pitch** = `atan2(localY, horizontal)`: the tilt up (+) / down (−).
 *
 * Returns `{ yawDeg: 0, pitchDeg: 0 }` for a degenerate zero-length aim (the
 * target sits on `from`). The caller maps yaw/pitch onto a rig's joints (a
 * head's twist + flexion, a camera's pan + tilt).
 *
 * @author Samchon
 */
export const aimYawPitch = (
  from: IAutoMovieVector3,
  to: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieYawPitch => {
  validateVector("from", from);
  validateVector("to", to);
  validateFinite("facingDeg", facingDeg);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  if (dx === 0 && dy === 0 && dz === 0) return { yawDeg: 0, pitchDeg: 0 };

  const f = (facingDeg * Math.PI) / 180;
  const cos = Math.cos(f);
  const sin = Math.sin(f);
  // rotate the world direction by −facing into the actor's local frame
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  const horizontal = Math.hypot(localX, localZ);
  return {
    yawDeg: (Math.atan2(localX, localZ) * 180) / Math.PI,
    pitchDeg: (Math.atan2(dy, horizontal) * 180) / Math.PI,
  };
};

const validateVector = (
  label: "from" | "to",
  value: IAutoMovieVector3,
): void => {
  for (const axis of VECTOR_AXES)
    validateFinite(`${label}.${axis}`, value[axis]);
};

const validateFinite = (label: string, value: number): void => {
  if (!Number.isFinite(value))
    throw new Error(`aimYawPitch ${label} must be finite, but was ${value}`);
};
