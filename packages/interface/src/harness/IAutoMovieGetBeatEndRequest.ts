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
  type: "getBeatEnd";

  /** Beat id whose end-state is pulled. */
  beat: string;
}
