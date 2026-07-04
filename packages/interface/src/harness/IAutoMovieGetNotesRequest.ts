/**
 * Query tool: pull the open review notes the loop must address — the correction
 * backlog from the last REVIEW. On a revise pass this is how blocking/
 * performance reads _what the reviewer asked to fix_ (closing the review→revise
 * loop) rather than rebuilding blind.
 *
 * @author Samchon
 */
export interface IAutoMovieGetNotesRequest {
  type: "getNotes";

  /** Scope to one beat, or omit for all open notes. */
  beat?: string;
}
