import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMoviePose } from "../pose/IAutoMoviePose";

/**
 * Placement of one model in a scene, plus what it is doing there.
 *
 * A scene node binds a model (a character or an object) to a world transform
 * and either a running motion clip or a held static pose. This is the seam
 * where automovie's structured building lowering and ordinary stage authoring
 * meet the renderer. A built environment defines logical rooms and visible
 * elements; its lowering places those elements here with the shared world
 * transform contract (see the scene coordinate note in the package README).
 *
 * @author Samchon
 */
export interface IAutoMovieSceneNode {
  /** Stable id for this placement. */
  id: string;

  /** Which model is placed here. */
  model: string;

  /** World placement (position / orientation / scale) of the model root. */
  transform: IAutoMovieTransform;

  /**
   * Id of the motion clip currently playing on this node, or `null` for a
   * static placement. Mutually exclusive with `pose`. Only meaningful for a
   * model that has a skeleton.
   */
  motion: string | null;

  /**
   * A held static pose when the node is not playing a motion, or `null` to use
   * the model's rest pose. Ignored when `motion` is set.
   */
  pose: IAutoMoviePose | null;
}
