/**
 * A stable id paired with a human / LLM readable name: the minimal identity an
 * authored artifact (a scene, a sequence) carries so later references resolve
 * it and an editor can label it.
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `IAutoMovieNamedId` as the portable data boundary for the asset rig basis controls requirement.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `IAutoMovieNamedId` for the asset spec rig inputs system contract.
 * @author Samchon
 */
export interface IAutoMovieNamedId {
  /**
   * Stable id.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `id` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `id` for the asset spec rig inputs system contract.
   */
  id: string;

  /**
   * Display name.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `name` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `name` for the asset spec rig inputs system contract.
   */
  name: string;
}
