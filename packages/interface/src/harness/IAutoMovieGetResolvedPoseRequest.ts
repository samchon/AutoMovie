/**
 * Engine query: the engine-resolved **world pose** of `actor` at shot-local
 * time `t` (the bones' world positions/rotations after FK + drivers + clamps).
 * The agent reads where a hand/foot actually ends up so it can chain the next
 * action onto real geometry (a follow-up that grabs the hand that just landed)
 * rather than re-deriving it.
 *
 * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `IAutoMovieGetResolvedPoseRequest` as the portable data boundary for the story dialogue action interaction requirement.
 * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `IAutoMovieGetResolvedPoseRequest` for the narrative intent utterance timing action system contract.
 * @author Samchon
 */
export interface IAutoMovieGetResolvedPoseRequest {
  /**
   * Selects the query that samples an engine-resolved actor pose.
   *
   * @evidence requirements/staging/scope-and-source-of-truth.md#staging-resolved-scene-state This discriminator identifies the cited read-only query contract.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-compatibility-stale-state This discriminator identifies the cited read-only query contract.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `type` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `type` for the narrative intent utterance timing action system contract.
   */
  type: "getResolvedPose";

  /**
   * The actor whose pose is resolved.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `actor` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `actor` for the narrative intent utterance timing action system contract.
   */
  actor: string;

  /**
   * Shot-local time in seconds.
   *
   * @evidence requirements/story/dialogue-language-and-silence.md#story-dialogue-action-interaction Exposes `t` as the portable data boundary for the story dialogue action interaction requirement.
   * @evidence specifications/narrative-and-intent/dialogue-language-theme-and-meaning.md#narrative-intent-utterance-timing-action Types `t` for the narrative intent utterance timing action system contract.
   */
  t: number;
}
