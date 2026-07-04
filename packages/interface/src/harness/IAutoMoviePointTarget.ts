import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * An action/camera target that is a **fixed world point**. Use a
 * {@link IAutoMovieNodeTarget} instead when the target is a live actor.
 *
 * @author Samchon
 */
export interface IAutoMoviePointTarget {
  kind: "point";

  /** World-space point pointed at. */
  point: IAutoMovieVector3;
}
