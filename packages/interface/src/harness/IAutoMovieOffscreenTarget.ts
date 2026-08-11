/**
 * An action target that is a **frame edge**: exit toward / aim at "off-screen
 * left", so an exit or glance needs no invented world coordinates.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMovieOffscreenTarget` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMovieOffscreenTarget` for the clv focus diagnostics refusal system contract.
 * @author Samchon
 */
export interface IAutoMovieOffscreenTarget {
  /**
   * Selects a frame-edge exit direction as the target representation.
   *
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-entry-exit-direction This discriminator makes the cited target form explicit in the action contract.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-line-eyeline-travel-evaluation This discriminator makes the cited target form explicit in the action contract.
   */
  kind: "offscreen";

  /**
   * Which frame edge.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `edge` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `edge` for the clv focus diagnostics refusal system contract.
   */
  edge: "left" | "right" | "forward" | "back";
}
