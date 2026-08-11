/**
 * A rotation expressed as intrinsic Euler angles in degrees.
 *
 * A middle ground between LLM-friendly single-axis semantic angles
 * ({@link IAutoMovieJointPose}) and the engine's quaternions
 * ({@link IAutoMovieQuaternion}). It is occasionally useful for free 3D objects
 * (a prop tilted on three axes) where there is no anatomical joint to attach
 * semantic flexion/abduction names to.
 *
 * `order` records the intrinsic rotation order so the engine can compose the
 * axes unambiguously. Euler angles are gimbal-prone and order-sensitive. This
 * type is intentionally secondary; prefer semantic joint angles for
 * characters.
 *
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `IAutoMovieEuler` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `IAutoMovieEuler` within the declared spatial transform chain.
 * @author Samchon
 */
export interface IAutoMovieEuler {
  /**
   * Rotation about the local X axis, degrees.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `x` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `x` within the declared spatial transform chain.
   */
  x: number;

  /**
   * Rotation about the local Y axis, degrees.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `y` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `y` within the declared spatial transform chain.
   */
  y: number;

  /**
   * Rotation about the local Z axis, degrees.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `z` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `z` within the declared spatial transform chain.
   */
  z: number;

  /**
   * Intrinsic rotation order in which `x`/`y`/`z` are applied.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `order` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `order` within the declared spatial transform chain.
   */
  order: "XYZ" | "XZY" | "YXZ" | "YZX" | "ZXY" | "ZYX";
}
