/**
 * A rotation expressed as intrinsic Euler angles in degrees.
 *
 * A middle ground between LLM-friendly single-axis semantic angles
 * ({@link IAutoFilmJointPose}) and the engine's quaternions
 * ({@link IAutoFilmQuaternion}). It is occasionally useful for free 3D objects
 * (a prop tilted on three axes) where there is no anatomical joint to attach
 * semantic flexion/abduction names to.
 *
 * `order` records the intrinsic rotation order so the engine can compose the
 * axes unambiguously. Euler angles are gimbal-prone and order-sensitive — this
 * type is intentionally secondary; prefer semantic joint angles for
 * characters.
 *
 * @author Samchon
 */
export interface IAutoFilmEuler {
  /** Rotation about the local X axis, degrees. */
  x: number;

  /** Rotation about the local Y axis, degrees. */
  y: number;

  /** Rotation about the local Z axis, degrees. */
  z: number;

  /** Intrinsic rotation order in which `x`/`y`/`z` are applied. */
  order: "XYZ" | "XZY" | "YXZ" | "YZX" | "ZXY" | "ZYX";
}
