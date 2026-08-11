import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";
import {
  AutoMovieDrawingProjection,
  AutoMovieDrawingRole,
} from "./IAutoMovieDrawingView";

/**
 * A point on the drawing page, in metres of model measured on the page.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingPoint` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingPoint` for the interior space drawing schedule quantity system contract.
 */
export interface IAutoMovieDrawingPoint {
  /**
   * Distance along the page right axis.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `x` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `x` for the interior space drawing schedule quantity system contract.
   */
  x: number;
  /**
   * Distance along the page up axis.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `y` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `y` for the interior space drawing schedule quantity system contract.
   */
  y: number;
}

/**
 * The orthonormal page basis a view resolved to.
 *
 * Published rather than kept private because every number in the drawing is
 * expressed in it: without the basis, a page coordinate cannot be turned back
 * into the world point it came from, and a consumer that wanted to check the
 * drawing against the design would have to re-derive the frame and hope it
 * matched.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingFrame` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingFrame` for the interior space drawing schedule quantity system contract.
 * @author Samchon
 */
export interface IAutoMovieDrawingFrame {
  /**
   * World point at page `(0, 0)`, and the point the cut plane passes through.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `origin` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `origin` for the interior space drawing schedule quantity system contract.
   */
  origin: IAutoMovieVector3;
  /**
   * Unit world direction of the page `+x` axis.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `right` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `right` for the interior space drawing schedule quantity system contract.
   */
  right: IAutoMovieVector3;
  /**
   * Unit world direction of the page `+y` axis.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `up` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `up` for the interior space drawing schedule quantity system contract.
   */
  up: IAutoMovieVector3;
  /**
   * Unit world normal of the cut/picture plane, pointing at the viewer.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `normal` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `normal` for the interior space drawing schedule quantity system contract.
   */
  normal: IAutoMovieVector3;
}

/**
 * One drafted straight segment and the design element that owns it.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingLine` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingLine` for the interior space drawing schedule quantity system contract.
 */
export interface IAutoMovieDrawingLine {
  /**
   * Building element this line was derived from.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `owner` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `owner` for the interior space drawing schedule quantity system contract.
   */
  owner: string;
  /**
   * Logical space the owning element occupies, or `null`.
   *
   * A separation drawn from its own face carries the first of the spaces it
   * divides. That is a property of the design rather than of the sheet that
   * drew it, so one party wall reads the same on both of its rooms' sheets
   * instead of renaming itself per view.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `space` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `space` for the interior space drawing schedule quantity system contract.
   */
  space: string | null;
  /**
   * Owning element's kind, which is the drafting layer.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `layer` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `layer` for the interior space drawing schedule quantity system contract.
   */
  layer: string;
  /**
   * Relation to the cut plane and the view depth.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `role` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `role` for the interior space drawing schedule quantity system contract.
   */
  role: AutoMovieDrawingRole;
  /**
   * Page start point; lexicographically at or before {@link to}.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `from` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `from` for the interior space drawing schedule quantity system contract.
   */
  from: IAutoMovieDrawingPoint;
  /**
   * Page end point.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `to` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `to` for the interior space drawing schedule quantity system contract.
   */
  to: IAutoMovieDrawingPoint;
}

/**
 * One logical volume's cross-section on the cut plane.
 *
 * A region is a space, not a room outline traced by hand: it is the exact
 * convex cross-section of one authored cell, so a room drawn on two sheets is
 * drawn from one declaration. Its area is the area of that cross-section and
 * nothing else — in particular it is not the space's floor area, which comes
 * from the support surfaces and is reported by the quantity report.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingRegion` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingRegion` for the interior space drawing schedule quantity system contract.
 * @author Samchon
 */
export interface IAutoMovieDrawingRegion {
  /**
   * Logical space this cross-section belongs to.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `space` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `space` for the interior space drawing schedule quantity system contract.
   */
  space: string;
  /**
   * Cell within that space.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `cell` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `cell` for the interior space drawing schedule quantity system contract.
   */
  cell: string;
  /**
   * Space kind, which is the region's drafting layer.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `kind` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `kind` for the interior space drawing schedule quantity system contract.
   */
  kind: string;
  /**
   * Convex page polygon in counter-clockwise order; at least three points.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `polygon` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `polygon` for the interior space drawing schedule quantity system contract.
   */
  polygon: IAutoMovieDrawingPoint[];
  /**
   * Exact area of {@link polygon} in square metres.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `area` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `area` for the interior space drawing schedule quantity system contract.
   */
  area: number;
  /**
   * Material id a finish view fills this region with, or `null`.
   *
   * Resolved from the material bound to the elements realizing the space's
   * boundaries. It is a surface material and not a construction build-up: a
   * material assembly is a separate record from the built environment, a
   * drawing is derived from the environment alone, and the drawing declares
   * that reach as a gap rather than inventing a layer order it cannot see.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `finish` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `finish` for the interior space drawing schedule quantity system contract.
   */
  finish: string | null;
}

/**
 * Where an opening mark's geometry came from.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `AutoMovieDrawingOpeningBasis` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `AutoMovieDrawingOpeningBasis` for the interior space drawing schedule quantity system contract.
 */
export type AutoMovieDrawingOpeningBasis = "profile" | "fill" | "none";

/**
 * One opening as the drawing can see it.
 *
 * The mark exists so a plan's openings and the 3D design's openings can be
 * compared by id rather than by eye: every opening the view covers appears
 * here, whether or not the design gave it a shape.
 *
 * {@link basis} says where the shape came from, and the three answers are not
 * interchangeable. `profile` is the opening's own void placed on its host
 * boundary's face — the design answering the question directly. `fill` is the
 * filling element's extent standing in for a void nobody authored, which is a
 * door's size and not the hole's. `none` is the design declining to answer, and
 * the mark then carries no geometry at all rather than a zero-sized one.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingOpeningMark` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingOpeningMark` for the interior space drawing schedule quantity system contract.
 * @author Samchon
 */
export interface IAutoMovieDrawingOpeningMark {
  /**
   * Opening identity, matching the design's own opening id.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `opening` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `opening` for the interior space drawing schedule quantity system contract.
   */
  opening: string;

  /**
   * Boundary the opening is cut through.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `boundary` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `boundary` for the interior space drawing schedule quantity system contract.
   */
  boundary: string;

  /**
   * Opening kind, such as `door`, `window`, `arch` or `passage`.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `kind` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `kind` for the interior space drawing schedule quantity system contract.
   */
  kind: string;

  /**
   * Filling element id, or `null` for an open cut.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `fill` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `fill` for the interior space drawing schedule quantity system contract.
   */
  fill: string | null;

  /**
   * Where the geometry below came from.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `basis` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `basis` for the interior space drawing schedule quantity system contract.
   */
  basis: AutoMovieDrawingOpeningBasis;

  /**
   * The void's own outline projected onto the page, and empty for every other
   * basis.
   *
   * A `fill` mark carries a size and no outline on purpose: it measures the
   * leaf standing in the hole, and drafting that leaf's extent as the void's
   * shape would put a rectangle on the sheet the building has no hole for.
   *
   * Arc edges are drafted as chords at a fixed density, which is what vector
   * linework is; the dimensions below are computed from the arcs themselves and
   * never from these chords.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `polygon` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `polygon` for the interior space drawing schedule quantity system contract.
   */
  polygon: IAutoMovieDrawingPoint[];

  /**
   * Width in metres of whatever {@link basis} says was measured, or `null` when
   * it says `none`.
   *
   * A `profile` mark measures the void; a `fill` mark measures the leaf that
   * stands in one. Reading either as the other is the mistake {@link basis}
   * exists to prevent, so neither is called the void's size here.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `width` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `width` for the interior space drawing schedule quantity system contract.
   */
  width: number | null;

  /**
   * Height in metres of the same thing, or `null` when `basis` is `none`.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `height` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `height` for the interior space drawing schedule quantity system contract.
   */
  height: number | null;
}

/**
 * Whether a pinned target still resolves against the current design.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `AutoMovieDrawingTargetStatus` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `AutoMovieDrawingTargetStatus` for the interior space drawing schedule quantity system contract.
 */
export type AutoMovieDrawingTargetStatus = "resolved" | "stale";

/**
 * One dimension as the drawing resolved it.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingDimension` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingDimension` for the interior space drawing schedule quantity system contract.
 */
export interface IAutoMovieDrawingDimension {
  /**
   * Dimension identity, as authored.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `id` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `id` for the interior space drawing schedule quantity system contract.
   */
  id: string;
  /**
   * What the measurement means.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `measure` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `measure` for the interior space drawing schedule quantity system contract.
   */
  measure: "page" | "world";
  /**
   * Whether both ends resolved.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `status` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `status` for the interior space drawing schedule quantity system contract.
   */
  status: AutoMovieDrawingTargetStatus;
  /**
   * Page start point, or `null` when stale.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `from` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `from` for the interior space drawing schedule quantity system contract.
   */
  from: IAutoMovieDrawingPoint | null;
  /**
   * Page end point, or `null` when stale.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `to` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `to` for the interior space drawing schedule quantity system contract.
   */
  to: IAutoMovieDrawingPoint | null;
  /**
   * Measured distance in metres, or `null` when stale.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `value` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `value` for the interior space drawing schedule quantity system contract.
   */
  value: number | null;
  /**
   * Exactly why the target no longer resolves, or `null` when resolved.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `reason` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `reason` for the interior space drawing schedule quantity system contract.
   */
  reason: string | null;
}

/**
 * One note as the drawing resolved it.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingAnnotation` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingAnnotation` for the interior space drawing schedule quantity system contract.
 */
export interface IAutoMovieDrawingAnnotation {
  /**
   * Annotation identity, as authored.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `id` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `id` for the interior space drawing schedule quantity system contract.
   */
  id: string;
  /**
   * Note text, as authored.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `text` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `text` for the interior space drawing schedule quantity system contract.
   */
  text: string;
  /**
   * Whether the target resolved.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `status` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `status` for the interior space drawing schedule quantity system contract.
   */
  status: AutoMovieDrawingTargetStatus;
  /**
   * Page position of the target, or `null` when stale.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `at` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `at` for the interior space drawing schedule quantity system contract.
   */
  at: IAutoMovieDrawingPoint | null;
  /**
   * Exactly why the target no longer resolves, or `null` when resolved.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `reason` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `reason` for the interior space drawing schedule quantity system contract.
   */
  reason: string | null;
}

/**
 * Whether a derivation is missing entirely or merely had nothing to run on.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `AutoMovieDrawingGapStatus` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `AutoMovieDrawingGapStatus` for the interior space drawing schedule quantity system contract.
 */
export type AutoMovieDrawingGapStatus = "unsupported" | "not-run";

/**
 * One derivation that produced nothing, and the exact reason.
 *
 * The same shape the render report uses, for the same reason: a drawing that
 * omitted what it could not compute would read as a drawing of a building with
 * no such thing in it. Naming the absence is the only way a sheet can be
 * trusted for what it does show.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingGap` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingGap` for the interior space drawing schedule quantity system contract.
 * @author Samchon
 */
export interface IAutoMovieDrawingGap {
  /**
   * What was not derived, as a stable machine-readable subject.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `subject` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `subject` for the interior space drawing schedule quantity system contract.
   */
  subject: string;
  /**
   * Whether the derivation does not exist or merely had no input.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `status` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `status` for the interior space drawing schedule quantity system contract.
   */
  status: AutoMovieDrawingGapStatus;
  /**
   * Exactly what is absent, naming the declaration that needed it.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `reason` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `reason` for the interior space drawing schedule quantity system contract.
   */
  reason: string;
  /**
   * Exactly what would make the derivation produce a result.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `remedy` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `remedy` for the interior space drawing schedule quantity system contract.
   */
  remedy: string;
}

/**
 * One drawing, derived from one design at one revision.
 *
 * Every line, region, opening mark, dimension and note below was computed from
 * the built environment the view was applied to. Nothing was drafted, and
 * nothing may be edited back into the design: the arrow points one way, from
 * design to drawing, so a sheet cannot become a second source of truth for the
 * building it depicts.
 *
 * The record is deterministic by construction. Page coordinates are rounded to
 * a fixed grid, every array is in a canonical order that does not depend on the
 * order the design happened to declare things in, and the digest covers the
 * whole of it — so the same design and the same view produce byte-identical
 * output on every machine and every run, which is what makes a drawing usable
 * as evidence at all.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawing` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawing` for the interior space drawing schedule quantity system contract.
 * @author Samchon
 */
export interface IAutoMovieDrawing {
  /**
   * Drawing format.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `version` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `version` for the interior space drawing schedule quantity system contract.
   */
  version: 1;

  /**
   * Versioned drawing protocol.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `protocol` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `protocol` for the interior space drawing schedule quantity system contract.
   */
  protocol: "automovie.drawing.v1";

  /**
   * View this drawing answers for.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `view` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `view` for the interior space drawing schedule quantity system contract.
   */
  view: string;

  /**
   * Cut and projection convention the view declared.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `projection` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `projection` for the interior space drawing schedule quantity system contract.
   */
  projection: AutoMovieDrawingProjection;

  /**
   * Discipline the view declared.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `discipline` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `discipline` for the interior space drawing schedule quantity system contract.
   */
  discipline: string;

  /**
   * Scale denominator the view declared.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `scale` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `scale` for the interior space drawing schedule quantity system contract.
   */
  scale: number;

  /**
   * Built environment this drawing was derived from.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `environment` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `environment` for the interior space drawing schedule quantity system contract.
   */
  environment: string;

  /**
   * Page basis the view resolved to.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `frame` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `frame` for the interior space drawing schedule quantity system contract.
   */
  frame: IAutoMovieDrawingFrame;

  /**
   * Page bounding box of everything the sheet draws, or `null` when it draws
   * nothing.
   *
   * Linework, region outlines, opening voids and every dimension and note that
   * resolved. The annotation is inside the box on purpose: a dimension string
   * sits beside the plan rather than across it, and a page sized from the
   * geometry alone would put the sheet's own annotation off the paper.
   *
   * A note contributes the point its text is set from rather than the glyphs it
   * sets, which the derivation cannot measure without font metrics and declares
   * as a gap instead of pretending to.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `extent` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `extent` for the interior space drawing schedule quantity system contract.
   */
  extent: IAutoMovieDrawingExtent | null;

  /**
   * Drafted segments, in canonical order.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `lines` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `lines` for the interior space drawing schedule quantity system contract.
   */
  lines: IAutoMovieDrawingLine[];

  /**
   * Logical volume cross-sections, in canonical order; empty for an elevation.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `regions` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `regions` for the interior space drawing schedule quantity system contract.
   */
  regions: IAutoMovieDrawingRegion[];

  /**
   * Every opening whose host boundary reaches a space this view covers, in
   * canonical order.
   *
   * The view's element-kind filter deliberately does not reach these. A mark is
   * how a sheet and the design are reconciled by id, so a lighting plan of a
   * room still answers for the room's doors rather than reporting a room with
   * none; what the kind filter decides is which linework is drafted, not which
   * openings exist.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `openings` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `openings` for the interior space drawing schedule quantity system contract.
   */
  openings: IAutoMovieDrawingOpeningMark[];

  /**
   * Resolved dimensions, in the order the view authored them.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `dimensions` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `dimensions` for the interior space drawing schedule quantity system contract.
   */
  dimensions: IAutoMovieDrawingDimension[];

  /**
   * Resolved notes, in the order the view authored them.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `annotations` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `annotations` for the interior space drawing schedule quantity system contract.
   */
  annotations: IAutoMovieDrawingAnnotation[];

  /**
   * Derivations this drawing could not perform, in canonical order.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `gaps` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `gaps` for the interior space drawing schedule quantity system contract.
   */
  gaps: IAutoMovieDrawingGap[];

  /**
   * Digest over the whole record.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `digest` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `digest` for the interior space drawing schedule quantity system contract.
   */
  digest: AutoMovieContentDigest;
}

/**
 * Page bounding box of a drawing's content.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingExtent` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingExtent` for the interior space drawing schedule quantity system contract.
 */
export interface IAutoMovieDrawingExtent {
  /**
   * Lowest page coordinate on each axis.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `min` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `min` for the interior space drawing schedule quantity system contract.
   */
  min: IAutoMovieDrawingPoint;
  /**
   * Highest page coordinate on each axis.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `max` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `max` for the interior space drawing schedule quantity system contract.
   */
  max: IAutoMovieDrawingPoint;
}
