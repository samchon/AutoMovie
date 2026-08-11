import type { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";

/**
 * Humanoid-bone capsule shared by body, validation, and soft-contact systems.
 *
 * The record is actor-local geometry only. A consumer supplies the actor and
 * evaluated pose whose bone segment places it in world space.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Reuses one capsule representation instead of inventing a soft-only body proxy.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Defines the bounded capsule consumed at the fixed-step collision boundary.
 * @author Samchon
 */
export interface IAutoMovieCapsuleProxy {
  /**
   * Humanoid bone at the first end of the actor-local segment.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Identifies one end of the shared body capsule.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Makes the collision segment resolve from the evaluated pose.
   */
  from: AutoMovieHumanoidBone;
  /**
   * Humanoid bone at the second end of the actor-local segment.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Identifies the other end of the shared body capsule.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Makes the collision segment resolve from the same evaluated pose.
   */
  to: AutoMovieHumanoidBone;
  /**
   * Finite strictly positive radius in meters.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Declares the bounded body volume rather than deriving a hidden radius.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Completes the shared capsule used by ordered collision projection.
   */
  radius: number;
}
