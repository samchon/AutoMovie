import { IautomovieVector3 } from "../geometry/IautomovieVector3";

/**
 * An action/camera target that is a **fixed world point**. Use a
 * {@link IautomovieNodeTarget} instead when the target is a live actor.
 *
 * @author Samchon
 */
export interface IautomoviePointTarget {
  kind: "point";

  /** World-space point pointed at. */
  point: IautomovieVector3;
}
