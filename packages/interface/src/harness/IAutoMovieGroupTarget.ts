/**
 * An action/camera target that is **several things at once**: a camera frames
 * their collective extent (a two-shot, a crowd).
 *
 * A group is the only target that can name a mass. A formation is stored as one
 * compact record, never as thousands of scene nodes, so listing its members by
 * id is not merely tedious, it is impossible: the ids do not exist until the
 * compiler materializes a slot. Naming the formation itself is what makes the
 * mass addressable, and the camera then frames the unit's real transformed
 * bounds rather than a point at its centroid.
 *
 * A formation is a thing a camera can FRAME. It is not a place an actor can aim
 * at: `lookAt`, `reach`, a gesture aim and a `launch` aim each need one point on
 * one body, and the perform gate refuses a formation named there rather than
 * silently aiming at the centroid of a crowd.
 *
 * @author Samchon
 */
export interface IAutoMovieGroupTarget {
  kind: "group";

  /** The scene-node ids framed together. */
  nodes: string[];

  /**
   * The formation design ids framed together with those nodes.
   *
   * Each id names a formation the shot compiled, and contributes that unit's
   * whole transformed extent — its slot footprint under the cue playing at the
   * framed instant, widened by a member's radius and raised by a member's
   * height — to what the camera must contain. Omit it for a group of ordinary
   * staged nodes.
   */
  formations?: string[];
}
