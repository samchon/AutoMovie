/**
 * Query tool: pull the staged scene (placements, cameras, lights, couplings).
 *
 * @author Samchon
 */
export interface IAutoMovieGetSceneRequest {
  /**
   * Selects the knowledge query that reads the staged scene contract.
   *
   * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output
   */
  type: "getScene";
}
