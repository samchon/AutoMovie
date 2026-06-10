import { IAutoFilmVector3 } from "../geometry/IAutoFilmVector3";

/**
 * An action/camera target that is a **fixed world point**. Use a
 * {@link IAutoFilmNodeTarget} instead when the target is a live actor.
 *
 * @author Samchon
 */
export interface IAutoFilmPointTarget {
  kind: "point";

  /** World-space point pointed at. */
  point: IAutoFilmVector3;
}
