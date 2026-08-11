/**
 * An action target that is a **frame edge**: exit toward / aim at "off-screen
 * left", so an exit or glance needs no invented world coordinates.
 *
 * @author Samchon
 */
export interface IAutoMovieOffscreenTarget {
  /**
   * Selects a frame-edge exit direction as the target representation.
   *
   * @evidence requirements/camera/axis-eyeline-and-screen-direction.md#camera-entry-exit-direction
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-line-eyeline-travel-evaluation
   */
  kind: "offscreen";

  /** Which frame edge. */
  edge: "left" | "right" | "forward" | "back";
}
