/**
 * Query tool: the **resolved end-state** of an already-built beat: where it
 * left every actor (final world position, facing, last pose). The forward-state
 * a later beat blocks against (HTN's "effects update the running world"), so a
 * sibling beat starts from where the previous one actually ended rather than
 * from the original staging. ({@link IAutoMovieGetShotRequest} returns the built
 * motion; this returns the tidy per-actor end-state precondition.)
 *
 * @author Samchon
 */
export interface IAutoMovieGetBeatEndRequest {
  /**
   * Selects the query that reads a beat's resolved end state.
   *
   * @evidence requirements/staging/state-handoff-and-continuity.md#staging-state-lineage
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-shot-scene-state-handoff
   */
  type: "getBeatEnd";

  /** Beat id whose end-state is pulled. */
  beat: string;
}
