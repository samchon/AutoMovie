/**
 * An action/camera target that is a **live scene node**: the engine resolves
 * its world position each frame, so it tracks a moving actor. Prefer this over
 * a literal point.
 *
 * @author Samchon
 */
export interface IAutoMovieNodeTarget {
  /**
   * Selects a live scene node as the target representation.
   *
   * @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-target-space
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-ik-constraint-reachability
   */
  kind: "node";

  /** The scene-node id pointed at. */
  node: string;
}
