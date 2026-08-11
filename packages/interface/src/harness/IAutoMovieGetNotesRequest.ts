/**
 * Query tool: pull the open review notes the loop must address: the correction
 * backlog from the last REVIEW. On a revise pass this is how blocking/
 * performance reads _what the reviewer asked to fix_ (closing the review→revise
 * loop) rather than rebuilding blind.
 *
 * @author Samchon
 */
export interface IAutoMovieGetNotesRequest {
  /**
   * Selects the query that reads outstanding review findings.
   *
   * @evidence requirements/review/annotations-findings-and-verdicts.md#review-finding-lifecycle
   * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-finding-lifecycle
   */
  type: "getNotes";

  /** Scope to one beat, or omit for all open notes. */
  beat?: string;
}
