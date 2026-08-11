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
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMovieModelPart` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMovieModelPart` for the asset spec geometry inputs system contract.
 * @author Samchon
 */
export interface IAutoMovieModelPart {
  /**
   * Stable id within the model.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `id` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `id` for the asset spec geometry inputs system contract.
   */
  id: string;

  /**
   * Human / LLM readable label (e.g. `"head"`, `"left forearm"`). Null if
   * unnamed.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `name` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `name` for the asset spec geometry inputs system contract.
   */
  name: string | null;

  /**
   * This part's geometry: a primitive or a mesh.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `geometry` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `geometry` for the asset spec geometry inputs system contract.
   */
  geometry: IAutoMovieGeometry;

  /**
   * Id of the material applied to this part, into the owning model's
   * `materials`. `null` = use the renderer default / unlit.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `material` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `material` for the asset spec geometry inputs system contract.
   */
  material: string | null;

  /**
   * For a **rigid** part, the bone it is parented to (rides that bone's
   * transform). `null` for a **skinned** part (deformation comes from the mesh
   * skin) or static geometry with no rig.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `attachedBone` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `attachedBone` for the asset spec geometry inputs system contract.
   */
  attachedBone: AutoMovieHumanoidBone | null;

  /**
   * Local transform of the part relative to its attachment (bone or model
   * root). `null` = identity.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `transform` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `transform` for the asset spec geometry inputs system contract.
   */
  transform: IAutoMovieTransform | null;
}
