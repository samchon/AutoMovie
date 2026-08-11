/**
 * Engine query: the engine-resolved **world pose** of `actor` at shot-local
 * time `t` (the bones' world positions/rotations after FK + drivers + clamps).
 * The agent reads where a hand/foot actually ends up so it can chain the next
 * action onto real geometry (a follow-up that grabs the hand that just landed)
 * rather than re-deriving it.
 *
 * @author Samchon
 */
export interface IAutoMovieGetResolvedPoseRequest {
  /**
   * Selects the query that samples an engine-resolved actor pose.
   *
   * @evidence requirements/staging/scope-and-source-of-truth.md#staging-resolved-scene-state
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-story-resolved-stage-boundary
   */
  type: "getResolvedPose";

  /** The actor whose pose is resolved. */
  actor: string;

  /** Shot-local time in seconds. */
  t: number;
}
