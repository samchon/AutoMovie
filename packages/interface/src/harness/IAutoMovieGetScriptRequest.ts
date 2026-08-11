/**
 * Query tool: pull the full script (logline, theme, cast, beats).
 *
 * @author Samchon
 */
export interface IAutoMovieGetScriptRequest {
  /**
   * Selects the knowledge query that reads the project script contract.
   *
   * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output
   */
  type: "getScript";
}
