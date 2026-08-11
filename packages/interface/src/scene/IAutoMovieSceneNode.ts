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
 * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `IAutoMovieSceneNode` as the portable data boundary for the map host scene placement requirement.
 * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `IAutoMovieSceneNode` for the world site host placement failure system contract.
 * @author Samchon
 */
export interface IAutoMovieSceneNode {
  /**
   * Stable id for this placement.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `id` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `id` for the world site host placement failure system contract.
   */
  id: string;

  /**
   * Which model is placed here.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `model` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `model` for the world site host placement failure system contract.
   */
  model: string;

  /**
   * World placement (position / orientation / scale) of the model root.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `transform` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `transform` for the world site host placement failure system contract.
   */
  transform: IAutoMovieTransform;

  /**
   * Id of the motion clip currently playing on this node, or `null` for a
   * static placement. Mutually exclusive with `pose`. Only meaningful for a
   * model that has a skeleton.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `motion` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `motion` for the world site host placement failure system contract.
   */
  motion: string | null;

  /**
   * A held static pose when the node is not playing a motion, or `null` to use
   * the model's rest pose. Ignored when `motion` is set.
   *
   * @evidence requirements/map/scope-and-coordinates.md#map-host-scene-placement Exposes `pose` as the portable data boundary for the map host scene placement requirement.
   * @evidence specifications/world-and-site/spatial-reference-and-identity.md#world-site-host-placement-failure Types `pose` for the world site host placement failure system contract.
   */
  pose: IAutoMoviePose | null;
}
