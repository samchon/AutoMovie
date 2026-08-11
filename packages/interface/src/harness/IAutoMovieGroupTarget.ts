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
 * at: `lookAt`, `reach`, a gesture aim and a `launch` aim each need one point
 * on one body, and the perform gate refuses a formation named there rather than
 * silently aiming at the centroid of a crowd.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMovieGroupTarget` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMovieGroupTarget` for the clv focus diagnostics refusal system contract.
 * @author Samchon
 */
export interface IAutoMovieGroupTarget {
  /**
   * Selects a multi-subject extent as the target representation.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-multi-subject-composition This discriminator makes the cited target form explicit in the action contract.
   * @evidence specifications/camera-light-and-visibility/framing-axis-and-camera-path.md#clv-framing-landmark-relations This discriminator makes the cited target form explicit in the action contract.
   */
  kind: "group";

  /**
   * The scene-node ids framed together.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `nodes` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `nodes` for the clv focus diagnostics refusal system contract.
   */
  nodes: string[];

  /**
   * The formation design ids framed together with those nodes.
   *
   * Each id names a formation the shot compiled, and contributes that unit's
   * whole transformed extent — its slot footprint under the cue playing at the
   * framed instant, widened by a member's radius and raised by a member's
   * height — to what the camera must contain. Omit it for a group of ordinary
   * staged nodes.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `formations` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `formations` for the clv focus diagnostics refusal system contract.
   */
  formations?: string[];
}
