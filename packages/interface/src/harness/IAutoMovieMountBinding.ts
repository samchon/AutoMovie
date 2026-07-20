import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";

/**
 * A persistent coupling fixed for the whole film: a rider on a mount, a
 * passenger in a cart. The bound node rides `parent`'s `bone` (e.g. a horse's
 * `spine` saddle). Declared once in staging rather than re-attached every
 * shot.
 *
 * @author Samchon
 */
export interface IAutoMovieMountBinding {
  /** The node ridden. */
  parent: string;

  /** The parent bone the rider is fixed to (e.g. a horse's `spine` saddle). */
  bone: AutoMovieHumanoidBone;
}
