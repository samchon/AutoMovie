import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";

/** A live bone on a rigged staged actor, resolved on the shot clock. */
export interface IAutoMovieBoneTarget {
  /**
   * Selects a live skeleton bone as the target representation.
   *
   * @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-target-space
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-ik-constraint-reachability
   */
  kind: "bone";

  /** Staged actor node carrying the rig. */
  node: string;

  /** Bone on that actor's declared skeleton. */
  bone: AutoMovieHumanoidBone;
}
