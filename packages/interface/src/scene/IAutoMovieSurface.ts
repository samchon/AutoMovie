import { IAutoMovieHeightRule } from "../geometry/IAutoMovieHeightRule";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { AutoMovieSurfaceKind } from "./AutoMovieSurfaceKind";

/**
 * One standable surface patch of a space: the semantic ground the engine
 * queries where it previously assumed a single scalar plane.
 *
 * The parameterization is deliberately minimal ("proxy means the thing", D011):
 * a **convex XZ footprint** plus one statement of how high the ground is over
 * it. The visual set piece behind a surface needs no new geometry type: a set
 * proxy is an ordinary static {@link IAutoMovieModel} (skeleton `null`) placed
 * as a scene node: a room is a box, a table is a box, per the stickman
 * doctrine. The surface is the _meaning_ (where feet and props may rest); the
 * model is the crude diffusion hint.
 *
 * **A surface states its ground exactly one way.** Either the general
 * {@link height} rule, which is the same rule a production world's terrain
 * carries, or the two-anchor spelling below, which says the same thing for the
 * flat and single-plane cases and is what every space authored before relief
 * existed says. Stating both, or neither, is refused by `validateSpace`: a
 * patch with two heights is a patch whose feet and whose renderer can disagree,
 * which is the whole failure this record exists to prevent.
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
   * Only `x` and `z` are used: the vertical extent comes from the height
   * statement, so `y` here is ignored (write `0`).
   */
  polygon: IAutoMovieVector3[];

  /**
   * The general ground rule: a `constant` level, a `plane` slope, or a
   * `heightfield` lattice the surface interpolates bilinearly.
   *
   * This is the one thing the two-anchor spelling cannot say. A flat patch and
   * a ramp are a level and a tilt, so relief — a rise, a terrace, a bank, a
   * stepped approach — has no anchors to be written with, and a shot staged on
   * terrain that rises had to flatten it. Carrying the world's own rule here
   * means the ground a crowd is placed on and the ground a performer plants a
   * foot on are one statement read by one function.
   *
   * Present means {@link anchor} and {@link rampTo} are absent, and the reverse.
   */
  height?: IAutoMovieHeightRule;

  /**
   * Height anchor: standing at this point's `(x, z)`, the surface height is its
   * `y`. For a flat patch this is the height everywhere on the polygon.
   *
   * The two-anchor spelling of {@link height}, and absent when that rule is
   * given. Kept because it is what every authored space says and because two
   * points are the plainest way to write a floor or a ramp.
   */
  anchor?: IAutoMovieVector3;

  /**
   * Second height anchor for a sloped surface: height interpolates linearly
   * from `anchor.y` to `rampTo.y` along the `anchor → rampTo` direction on the
   * XZ plan (constant perpendicular to it). Its `(x, z)` must differ from
   * `anchor`'s. `null` or absent = flat at `anchor.y`.
   */
  rampTo?: IAutoMovieVector3 | null;
}
