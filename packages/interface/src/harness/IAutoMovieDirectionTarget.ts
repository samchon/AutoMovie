/**
 * An action target that is a **heading relative to the actor's current facing**
 * (0 = ahead, +90 = its left), so the model can say "walk off to the left"
 * without inventing world coordinates.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMovieDirectionTarget` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMovieDirectionTarget` for the clv focus diagnostics refusal system contract.
 * @author Samchon
 */
export interface IAutoMovieDirectionTarget {
  /**
   * Selects an actor-relative heading as the target representation.
   *
   * @evidence requirements/motion/root-motion-and-trajectories.md#motion-facing-travel This discriminator makes the cited target form explicit in the action contract.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-line-eyeline-travel-evaluation This discriminator makes the cited target form explicit in the action contract.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `kind` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `kind` for the clv focus diagnostics refusal system contract.
   */
  kind: "direction";

  /**
   * Heading in degrees, relative to the actor's facing (0 = ahead).
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `headingDeg` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `headingDeg` for the clv focus diagnostics refusal system contract.
   */
  headingDeg: number;
}
