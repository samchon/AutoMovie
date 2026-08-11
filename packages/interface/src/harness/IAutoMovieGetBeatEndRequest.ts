/**
 * Query tool: the **resolved end-state** of an already-built beat: where it
 * left every actor (final world position, facing, last pose). The forward-state
 * a later beat blocks against (HTN's "effects update the running world"), so a
 * sibling beat starts from where the previous one actually ended rather than
 * from the original staging. ({@link IAutoMovieGetShotRequest} returns the built
 * motion; this returns the tidy per-actor end-state precondition.)
 *
 * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `IAutoMovieGetBeatEndRequest` as the portable data boundary for the story beat observation plan requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `IAutoMovieGetBeatEndRequest` for the narrative intent beat observation boundary system contract.
 * @author Samchon
 */
export interface IAutoMovieGetBeatEndRequest {
  /**
   * Selects the query that reads a beat's resolved end state.
   *
   * @evidence requirements/staging/state-handoff-and-continuity.md#staging-state-lineage This discriminator identifies the cited read-only query contract.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-compatibility-stale-state This discriminator identifies the cited read-only query contract.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `type` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `type` for the narrative intent beat observation boundary system contract.
   */
  type: "getBeatEnd";

  /**
   * Beat id whose end-state is pulled.
   *
   * @evidence requirements/story/beats-and-causality.md#story-beat-observation-plan Exposes `beat` as the portable data boundary for the story beat observation plan requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `beat` for the narrative intent beat observation boundary system contract.
   */
  beat: string;
}
