import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";
import { IAutoMovieGeometry } from "./IAutoMovieGeometry";

/**
 * One piece of a model: a chunk of geometry, the material on it, and how it
 * attaches to the rig.
 *
 * A model is assembled from parts so a character can mix paths (a primitive
 * torso here, an imported mesh head there) and so each surface can carry its
 * own material. How a part follows the skeleton is captured by two mutually
 * informing fields: a _skinned_ part deforms via its mesh's
 * {@link IAutoMovieMeshSkin} (`attachedBone` is `null`); a _rigid_ part (a prop,
 * a sword, a primitive limb) is parented wholesale to one bone via
 * `attachedBone` and rides its transform.
 *
 * @author Samchon
 */
export interface IAutoMovieModelPart {
  /** Stable id within the model. */
  id: string;

  /**
   * Human / LLM readable label (e.g. `"head"`, `"left forearm"`). Null if
   * unnamed.
   */
  name: string | null;

  /** This part's geometry: a primitive or a mesh. */
  geometry: IAutoMovieGeometry;

  /**
   * Id of the material applied to this part, into the owning model's
   * `materials`. `null` = use the renderer default / unlit.
   */
  material: string | null;

  /**
   * For a **rigid** part, the bone it is parented to (rides that bone's
   * transform). `null` for a **skinned** part (deformation comes from the mesh
   * skin) or static geometry with no rig.
   */
  attachedBone: AutoMovieHumanoidBone | null;

  /**
   * Local transform of the part relative to its attachment (bone or model
   * root). `null` = identity.
   */
  transform: IAutoMovieTransform | null;
}
