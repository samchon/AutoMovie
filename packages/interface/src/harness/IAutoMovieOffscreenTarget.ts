/**
 * An action target that is a **frame edge** ??exit toward / aim at "off-screen
 * left", so an exit or glance needs no invented world coordinates.
 *
 * @author Samchon
 */
export interface IautomovieOffscreenTarget {
  kind: "offscreen";

  /** Which frame edge. */
  edge: "left" | "right" | "forward" | "back";
}
