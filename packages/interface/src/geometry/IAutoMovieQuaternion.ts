/**
 * A unit quaternion `(x, y, z, w)` describing a 3D rotation.
 *
 * This is **engine / interchange representation, not LLM-facing**. automovie
 * exposes joint rotation to the model as semantic degrees precisely because
 * quaternions are opaque to language models and easy to emit wrong (the
 * unit-norm constraint is not something a model tracks). The engine produces
 * quaternions when converting a validated {@link IAutoMovieJointPose} into
 * bone-local rotations for `three.js` / glTF / VRMA export, and consumes them
 * when ingesting an imported rig back into semantic angles.
 *
 * Order is glTF's `(x, y, z, w)`. The vector is expected to be unit-norm; the
 * engine normalizes defensively rather than rejecting near-unit input.
 *
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `IAutoMovieQuaternion` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `IAutoMovieQuaternion` within the declared spatial transform chain.
 * @author Samchon
 */
export interface IAutoMovieQuaternion {
  /**
   * Imaginary i component.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `x` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `x` within the declared spatial transform chain.
   */
  x: number;

  /**
   * Imaginary j component.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `y` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `y` within the declared spatial transform chain.
   */
  y: number;

  /**
   * Imaginary k component.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `z` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `z` within the declared spatial transform chain.
   */
  z: number;

  /**
   * Real (scalar) component.
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `w` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `w` within the declared spatial transform chain.
   */
  w: number;
}
