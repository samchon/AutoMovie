/**
 * An action target that is a **heading relative to the actor's current facing**
 * (0 = ahead, +90 = its left), so the model can say "walk off to the left"
 * without inventing world coordinates.
 *
 * @author Samchon
 */
export interface IAutoMovieDirectionTarget {
  /**
   * Selects an actor-relative heading as the target representation.
   *
   * @evidence requirements/motion/root-motion-and-trajectories.md#motion-facing-travel
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-root-trajectory-authority
   */
  kind: "direction";

  /** Heading in degrees, relative to the actor's facing (0 = ahead). */
  headingDeg: number;
}
