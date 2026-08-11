/**
 * Query tool: pull an already-built sibling shot, to match its ending
 * pose/position/energy.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-scene-shot-separation Exposes `IAutoMovieGetShotRequest` as the portable data boundary for the story scene shot separation requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `IAutoMovieGetShotRequest` for the narrative intent beat observation boundary system contract.
 * @author Samchon
 */
export interface IAutoMovieGetShotRequest {
  /**
   * Selects the knowledge query that reads a built shot contract.
   *
   * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance This discriminator identifies the cited read-only query contract.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output This discriminator identifies the cited read-only query contract.
   */
  type: "getShot";

  /**
   * Beat id of the sibling shot to pull.
   *
   * @evidence requirements/story/scenes-and-observable-action.md#story-scene-shot-separation Exposes `beat` as the portable data boundary for the story scene shot separation requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-beat-observation-boundary Types `beat` for the narrative intent beat observation boundary system contract.
   */
  beat: string;
}
