/**
 * Query tool: pull the open review notes the loop must address: the correction
 * backlog from the last REVIEW. On a revise pass this is how blocking/
 * performance reads _what the reviewer asked to fix_ (closing the review→revise
 * loop) rather than rebuilding blind.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `IAutoMovieGetNotesRequest` as the portable data boundary for the story time state review scope requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `IAutoMovieGetNotesRequest` for the narrative intent temporal state handoff system contract.
 * @author Samchon
 */
export interface IAutoMovieGetNotesRequest {
  /**
   * Selects the query that reads outstanding review findings.
   *
   * @evidence requirements/review/annotations-findings-and-verdicts.md#review-finding-lifecycle This discriminator identifies the cited read-only query contract.
   * @evidence specifications/review-and-acceptance/observations-findings-and-defects.md#review-system-finding-lifecycle This discriminator identifies the cited read-only query contract.
   */
  type: "getNotes";

  /**
   * Scope to one beat, or omit for all open notes.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `beat` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `beat` for the narrative intent temporal state handoff system contract.
   */
  beat?: string;
}
