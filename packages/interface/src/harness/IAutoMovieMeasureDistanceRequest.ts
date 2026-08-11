import { IAutoMovieActionTarget } from "./IAutoMovieActionCall";

/** A scene-only distance endpoint: no rig or relative direction required. */
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
 * @author Samchon
 */
export interface IAutoMovieMeasureDistanceRequest {
  /**
   * Selects the spatial distance query.
   *
   * @evidence requirements/staging/budgets-safety-and-validation.md#staging-spatial-validation
   * @evidence specifications/performance-motion-and-staging/staging-events-coverage-and-validation.md#performance-staging-budget-safety-validation
   */
  type: "measureDistance";

  /** One endpoint. */
  from: IAutoMovieDistanceTarget;

  /** The other endpoint. */
  to: IAutoMovieDistanceTarget;
}
