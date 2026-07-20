import { IAutoMovieScene, IAutoMovieVector3 } from "@automovie/interface";

/**
 * The placement table {@link resolveTargetPoint} resolves a positional action
 * target against: every staged thing that owns a world position, keyed by id.
 * That is the scene's nodes (actors, props, set pieces) **and its cameras**.
 *
 * A camera is a placed object with a translation, and direct address, an actor
 * looking down the lens, is ordinary film grammar; staging already lets a
 * camera aim at an actor or a set piece, so the reverse direction is the same
 * geometry read backwards. It was refused only because the perform gate built
 * its lookup from `scene.nodes` alone (#1294). The camera-as-actor rule is
 * untouched: a camera still performs nothing but `frame`, it is only a place to
 * point at.
 *
 * One table, one convention: the perform gate and the reference synthesizer
 * must never disagree about which ids resolve, or a target passes validation
 * and then silently synthesizes no motion. Cameras are laid down first so that
 * a hand-authored scene which (illegally) repeats an id between a node and a
 * camera still resolves to the node, the behaviour before cameras joined.
 *
 * @author Samchon
 */
export const scenePlacements = (
  scene: IAutoMovieScene,
): Map<string, IAutoMovieVector3> =>
  new Map<string, IAutoMovieVector3>([
    ...scene.cameras.map(
      (camera) => [camera.id, camera.transform.translation] as const,
    ),
    ...scene.nodes.map(
      (node) => [node.id, node.transform.translation] as const,
    ),
  ]);
