/**
 * An action/camera target that is a **live scene node**: the engine resolves
 * its world position each frame, so it tracks a moving actor. Prefer this over
 * a literal point.
 *
 * @author Samchon
 */
export interface IAutoMovieNodeTarget {
  kind: "node";

  /** The scene-node id pointed at. */
  node: string;
}
