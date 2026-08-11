import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";

/**
 * A live bone on a rigged staged actor, resolved on the shot clock.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMovieBoneTarget` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMovieBoneTarget` for the clv focus diagnostics refusal system contract.
 */
export interface IAutoMovieBoneTarget {
  /**
   * Selects a live skeleton bone as the target representation.
   *
   * @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-target-space This discriminator makes the cited target form explicit in the action contract.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This discriminator makes the cited target form explicit in the action contract.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `kind` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `kind` for the clv focus diagnostics refusal system contract.
   */
  kind: "bone";

  /**
   * Staged actor node carrying the rig.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `node` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `node` for the clv focus diagnostics refusal system contract.
   */
  node: string;

  /**
   * Bone on that actor's declared skeleton.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `bone` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `bone` for the clv focus diagnostics refusal system contract.
   */
  bone: AutoMovieHumanoidBone;
}
