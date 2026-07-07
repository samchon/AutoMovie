import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { AutoMovieSurfaceKind } from "./AutoMovieSurfaceKind";

/**
 * One standable surface patch of a space — the semantic ground the engine
 * queries where it previously assumed a single scalar plane.
 *
 * The parameterization is deliberately minimal ("proxy means the thing", D011):
 * a **convex XZ footprint** plus height anchors. A flat patch (floor, platform
 * top) is the polygon at `anchor.y`. A sloped patch (ramp) carries a second
 * anchor: height interpolates linearly along the `anchor → rampTo` axis on the
 * ground plan and is constant perpendicular to it — a plane, which is what a
 * real ramp is. Stairs are approximated as a ramp for now.
 *
 * The visual set piece behind a surface needs no new geometry type: a set proxy
 * is an ordinary static {@link IAutoMovieModel} (skeleton `null`) placed as a
 * scene node — a room is a box, a table is a box, per the stickman doctrine.
 * The surface is the _meaning_ (where feet and props may rest); the model is
 * the crude diffusion hint.
 *
 * @author Samchon
 */
export interface IAutoMovieSurface {
  /** Stable id; `IAutoMovieSpace.walkable` cites surfaces by this. */
  id: string;

  /** Discriminator-like semantic label (does not change the math). */
  kind: AutoMovieSurfaceKind;

  /**
   * Convex footprint on the ground plan, at least three non-collinear points.
   * Only `x` and `z` are used — the vertical extent comes from the height
   * anchors, so `y` here is ignored (write `0`).
   */
  polygon: IAutoMovieVector3[];

  /**
   * Height anchor: standing at this point's `(x, z)`, the surface height is its
   * `y`. For a flat patch this is the height everywhere on the polygon.
   */
  anchor: IAutoMovieVector3;

  /**
   * Second height anchor for a sloped surface: height interpolates linearly
   * from `anchor.y` to `rampTo.y` along the `anchor → rampTo` direction on the
   * XZ plan (constant perpendicular to it). Its `(x, z)` must differ from
   * `anchor`'s. `null` = flat at `anchor.y`.
   */
  rampTo: IAutoMovieVector3 | null;
}
