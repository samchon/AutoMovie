/**
 * An action/camera target that is a **live scene node**: the engine resolves
 * its world position each frame, so it tracks a moving actor. Prefer this over
 * a literal point.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMovieNodeTarget` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMovieNodeTarget` for the clv focus diagnostics refusal system contract.
 * @author Samchon
 */
export interface IAutoMovieNodeTarget {
  /**
   * Selects a live scene node as the target representation.
   *
   * @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-target-space This discriminator makes the cited target form explicit in the action contract.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This discriminator makes the cited target form explicit in the action contract.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `kind` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `kind` for the clv focus diagnostics refusal system contract.
   */
  kind: "node";

  /**
   * The scene-node id pointed at.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `node` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `node` for the clv focus diagnostics refusal system contract.
   */
  node: string;
}
