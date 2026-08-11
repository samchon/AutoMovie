import { IAutoMovieActionTarget } from "./IAutoMovieActionCall";

/**
 * A scene-only distance endpoint: no rig or relative direction required.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `IAutoMovieDistanceTarget` as the portable data boundary for the camera focus distance requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `IAutoMovieDistanceTarget` for the clv focus intent appearance boundary system contract.
 */
export type IAutoMovieDistanceTarget = Extract<
  IAutoMovieActionTarget,
  { kind: "node" | "point" | "group" }
>;

/**
 * Engine query: world distance between two targets at the current staging: the
 * raw range check behind blocking decisions (is the pursuer close enough to
 * lunge, are the two actors a conversational distance apart). Each endpoint is
 * a live scene node, a literal point, or a group's centroid; live bones need a
 * rig and shot clock, so they belong to `getReach`/`getResolvedPose`.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `IAutoMovieMeasureDistanceRequest` as the portable data boundary for the camera focus distance requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `IAutoMovieMeasureDistanceRequest` for the clv focus intent appearance boundary system contract.
 * @author Samchon
 */
export interface IAutoMovieMeasureDistanceRequest {
  /**
   * Selects the spatial distance query.
   *
   * @evidence requirements/staging/budgets-safety-and-validation.md#staging-spatial-validation This discriminator identifies the cited read-only query contract.
   * @evidence specifications/performance-motion-and-staging/staging-space-state-and-choreography.md#performance-staging-mark-surface-zone-membership This discriminator identifies the cited read-only query contract.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `type` as the portable data boundary for the camera focus distance requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `type` for the clv focus intent appearance boundary system contract.
   */
  type: "measureDistance";

  /**
   * One endpoint.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `from` as the portable data boundary for the camera focus distance requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `from` for the clv focus intent appearance boundary system contract.
   */
  from: IAutoMovieDistanceTarget;

  /**
   * The other endpoint.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-focus-distance Exposes `to` as the portable data boundary for the camera focus distance requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-intent-appearance-boundary Types `to` for the clv focus intent appearance boundary system contract.
   */
  to: IAutoMovieDistanceTarget;
}
