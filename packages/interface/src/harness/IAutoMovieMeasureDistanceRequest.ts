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
  type: "measureDistance";

  /** One endpoint. */
  from: IAutoMovieDistanceTarget;

  /** The other endpoint. */
  to: IAutoMovieDistanceTarget;
}
