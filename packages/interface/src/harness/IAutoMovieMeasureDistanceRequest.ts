import { IAutoMovieActionTarget } from "./IAutoMovieActionCall";

/**
 * Engine query: world distance between two targets at the current staging — the
 * raw range check behind blocking decisions (is the pursuer close enough to
 * lunge, are the two actors a conversational distance apart). Targets resolve
 * the same way an action's do (a live node, a point, a group's extent).
 *
 * @author Samchon
 */
export interface IAutoMovieMeasureDistanceRequest {
  type: "measureDistance";

  /** One endpoint. */
  from: IAutoMovieActionTarget;

  /** The other endpoint. */
  to: IAutoMovieActionTarget;
}
