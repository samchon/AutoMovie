/**
 * Query tool: pull the staged scene (placements, cameras, lights, couplings).
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-scene-local-arc Exposes `IAutoMovieGetSceneRequest` as the portable data boundary for the story scene local arc requirement.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Types `IAutoMovieGetSceneRequest` for the narrative intent scene prose index system contract.
 * @author Samchon
 */
export interface IAutoMovieGetSceneRequest {
  /**
   * Selects the knowledge query that reads the staged scene contract.
   *
   * @evidence requirements/agent-authoring/knowledge-boundary.md#agent-contract-guidance This discriminator identifies the cited read-only query contract.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output This discriminator identifies the cited read-only query contract.
   */
  type: "getScene";
}
