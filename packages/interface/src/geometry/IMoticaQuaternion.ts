/**
 * A unit quaternion `(x, y, z, w)` describing a 3D rotation.
 *
 * This is **engine / interchange representation, not LLM-facing**. motica
 * exposes joint rotation to the model as semantic degrees precisely because
 * quaternions are opaque to language models and easy to emit wrong (the
 * unit-norm constraint is not something a model tracks). The engine produces
 * quaternions when converting a validated {@link IMoticaJointPose} into
 * bone-local rotations for `three.js` / glTF / VRMA export, and consumes them
 * when ingesting an imported rig back into semantic angles.
 *
 * Order is glTF's `(x, y, z, w)`. The vector is expected to be unit-norm; the
 * engine normalizes defensively rather than rejecting near-unit input.
 *
 * @author Samchon
 */
export interface IMoticaQuaternion {
  /** Imaginary i component. */
  x: number;

  /** Imaginary j component. */
  y: number;

  /** Imaginary k component. */
  z: number;

  /** Real (scalar) component. */
  w: number;
}
