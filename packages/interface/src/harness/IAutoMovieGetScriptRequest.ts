/**
 * Query tool: pull the full script (logline, theme, cast, beats).
 *
 * @evidence requirements/story/beats-and-causality.md#story-semantic-event-identity Exposes `IAutoMovieGetScriptRequest` as the portable data boundary for the story semantic event identity requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-semantic-event-occurrence Types `IAutoMovieGetScriptRequest` for the narrative intent semantic event occurrence system contract.
 * @author Samchon
 */
export interface IAutoMovieGetScriptRequest {
  /**
   * Selects the knowledge query that reads the project script contract.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance This discriminator identifies the cited read-only query contract.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output This discriminator identifies the cited read-only query contract.
   */
  type: "getScript";
}
