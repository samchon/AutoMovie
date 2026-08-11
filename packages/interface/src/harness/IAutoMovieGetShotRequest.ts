/**
 * Query tool: pull an already-built sibling shot, to match its ending
 * pose/position/energy.
 *
 * @author Samchon
 */
export interface IAutoMovieGetShotRequest {
  /**
   * Selects the knowledge query that reads a built shot contract.
   *
   * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output
   */
  type: "getShot";

  /** Beat id of the sibling shot to pull. */
  beat: string;
}
