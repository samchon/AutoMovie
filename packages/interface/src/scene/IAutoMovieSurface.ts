import { IAutoMovieHeightRule } from "../geometry/IAutoMovieHeightRule";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { AutoMovieSurfaceKind } from "./AutoMovieSurfaceKind";

/**
 * One standable surface patch of a space: the semantic ground the engine
 * queries where it previously assumed a single scalar plane.
 *
 * The parameterization is deliberately minimal ("proxy means the thing", D011):
 * an **XZ footprint** — one outer ring, optionally holed — plus one statement
 * of how high the ground is over it. The visual set piece behind a surface
 * needs no new geometry type: a set proxy is an ordinary static
 * {@link IAutoMovieModel} (skeleton `null`) placed as a scene node: a room is a
 * box, a table is a box, per the stickman doctrine. The surface is the
 * _meaning_ (where feet and props may rest); the model is the crude diffusion
 * hint.
 *
 * **A surface states its ground exactly one way.** Either the general
 * {@link height} rule, which is the same rule a production world's terrain
 * carries, or the two-anchor spelling below, which says the same thing for the
 * flat and single-plane cases and is what every space authored before relief
 * existed says. Stating both, or neither, is refused by `validateSpace`: a
 * patch with two heights is a patch whose feet and whose renderer can disagree,
 * which is the whole failure this record exists to prevent.
 *
 * **The ground over a footprint is single-valued, and that is a stated limit
 * rather than an omission.** An overhanging balcony soffit, a vertical face,
 * and a ramp that spirals over its own lower flight all have two heights at one
 * plan position, and no {@link height} rule can say two. They are not
 * approximated into one patch here: the ground query answers the topmost patch
 * over a plan point, so a lower patch directly beneath another is ground
 * nothing can be placed on. Author the flights as separate spaces, and read
 * multi-valued ground as unsupported rather than as relief that came out flat.
 *
 * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope Exposes `IAutoMovieSurface` as the portable data boundary for the interior floor level slope requirement.
 * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-level-storey-height-constraints Types `IAutoMovieSurface` for the interior space level storey height constraints system contract.
 * @author Samchon
 */
export interface IAutoMovieSurface {
  /**
   * Stable id; `IAutoMovieSpace.walkable` cites surfaces by this.
   *
   * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope Exposes `id` as the portable data boundary for the interior floor level slope requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-level-storey-height-constraints Types `id` for the interior space level storey height constraints system contract.
   */
  id: string;

  /**
   * Discriminator-like semantic label (does not change the math).
   *
   * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope Exposes `kind` as the portable data boundary for the interior floor level slope requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-level-storey-height-constraints Types `kind` for the interior space level storey height constraints system contract.
   */
  kind: AutoMovieSurfaceKind;

  /**
   * Outer footprint ring on the ground plan, at least three non-collinear
   * points. Only `x` and `z` are used: the vertical extent comes from the
   * height statement, so `y` here is ignored (write `0`).
   *
   * The ring is a simple polygon and **may be concave**: an L-shaped floor
   * plate keeps its notch, because the ground query classifies against the ring
   * itself rather than against its convex hull. What it may not do is cross
   * itself, because a self-crossing ring has no inside for a foot to be on, and
   * `validateSpace` refuses one.
   *
   * A curved edge has no spelling here. Author it as chords and read it as
   * exactly those chords: the footprint is never resampled, so what the ground
   * query answers is what was written rather than a curve somebody assumed.
   *
   * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope Exposes `polygon` as the portable data boundary for the interior floor level slope requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-level-storey-height-constraints Types `polygon` for the interior space level storey height constraints system contract.
   */
  polygon: IAutoMovieVector3[];

  /**
   * Voids cut in the footprint: the atrium opening through a floor plate, a
   * stairwell, a light well.
   *
   * This is what lets a slab with an atrium void be **one** support patch. Cut
   * as a ring of separate patches instead, the void's edge becomes a seam
   * between records that can be edited apart, and a foot planted on the seam
   * asks two patches which ground it is on.
   *
   * Each hole is its own simple ring of at least three points, lying strictly
   * inside {@link polygon} and disjoint from every other hole; `validateSpace`
   * refuses anything else. A plan point strictly inside a hole is **off** the
   * surface, exactly as a point outside the outer ring is, while a point on a
   * hole's own rim is still on the slab: the rings bound a closed region.
   *
   * The rings say where the surface is, never how high it is. What stands under
   * a hole is whatever other patch is authored there, or nothing.
   *
   * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope Exposes `holes` as the portable data boundary for the interior floor level slope requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-level-storey-height-constraints Types `holes` for the interior space level storey height constraints system contract.
   */
  holes?: IAutoMovieVector3[][];

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
   *
   * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope Exposes `height` as the portable data boundary for the interior floor level slope requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-level-storey-height-constraints Types `height` for the interior space level storey height constraints system contract.
   */
  height?: IAutoMovieHeightRule;

  /**
   * Height anchor: standing at this point's `(x, z)`, the surface height is its
   * `y`. For a flat patch this is the height everywhere on the polygon.
   *
   * The two-anchor spelling of {@link height}, and absent when that rule is
   * given. Kept because it is what every authored space says and because two
   * points are the plainest way to write a floor or a ramp.
   *
   * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope Exposes `anchor` as the portable data boundary for the interior floor level slope requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-level-storey-height-constraints Types `anchor` for the interior space level storey height constraints system contract.
   */
  anchor?: IAutoMovieVector3;

  /**
   * Second height anchor for a sloped surface: height interpolates linearly
   * from `anchor.y` to `rampTo.y` along the `anchor → rampTo` direction on the
   * XZ plan (constant perpendicular to it). Its `(x, z)` must differ from
   * `anchor`'s. `null` or absent = flat at `anchor.y`.
   *
   * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope Exposes `rampTo` as the portable data boundary for the interior floor level slope requirement.
   * @evidence specifications/interior-space/space-level-zone-topology.md#interior-space-level-storey-height-constraints Types `rampTo` for the interior space level storey height constraints system contract.
   */
  rampTo?: IAutoMovieVector3 | null;
}
