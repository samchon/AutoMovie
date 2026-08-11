import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * An action/camera target that is a **fixed world point**. Use a
 * {@link IAutoMovieNodeTarget} instead when the target is a live actor.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMoviePointTarget` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMoviePointTarget` for the clv focus diagnostics refusal system contract.
 * @author Samchon
 */
export interface IAutoMoviePointTarget {
  /**
   * Selects a fixed world-space point as the target representation.
   *
   * @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-target-space This discriminator makes the cited target form explicit in the action contract.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This discriminator makes the cited target form explicit in the action contract.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `kind` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `kind` for the clv focus diagnostics refusal system contract.
   */
  kind: "point";

  /**
   * World-space point pointed at.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `point` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `point` for the clv focus diagnostics refusal system contract.
   */
  point: IAutoMovieVector3;
}
