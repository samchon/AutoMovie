import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";
import {
  AutoMovieDrawingProjection,
  AutoMovieDrawingRole,
} from "./IAutoMovieDrawingView";

/** A point on the drawing page, in metres of model measured on the page. */
export interface IAutoMovieDrawingPoint {
  /** Distance along the page right axis. */
  x: number;
  /** Distance along the page up axis. */
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
 * @author Samchon
 */
export interface IAutoMovieDrawingFrame {
  /** World point at page `(0, 0)`, and the point the cut plane passes through. */
  origin: IAutoMovieVector3;
  /** Unit world direction of the page `+x` axis. */
  right: IAutoMovieVector3;
  /** Unit world direction of the page `+y` axis. */
  up: IAutoMovieVector3;
  /** Unit world normal of the cut/picture plane, pointing at the viewer. */
  normal: IAutoMovieVector3;
}

/** One drafted straight segment and the design element that owns it. */
export interface IAutoMovieDrawingLine {
  /** Building element this line was derived from. */
  owner: string;
  /**
   * Logical space the owning element occupies, or `null`.
   *
   * A separation drawn from its own face carries the first of the spaces it
   * divides. That is a property of the design rather than of the sheet that
   * drew it, so one party wall reads the same on both of its rooms' sheets
   * instead of renaming itself per view.
   */
  space: string | null;
  /** Owning element's kind, which is the drafting layer. */
  layer: string;
  /** Relation to the cut plane and the view depth. */
  role: AutoMovieDrawingRole;
  /** Page start point; lexicographically at or before {@link to}. */
  from: IAutoMovieDrawingPoint;
  /** Page end point. */
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
 * @author Samchon
 */
export interface IAutoMovieDrawingRegion {
  /** Logical space this cross-section belongs to. */
  space: string;
  /** Cell within that space. */
  cell: string;
  /** Space kind, which is the region's drafting layer. */
  kind: string;
  /** Convex page polygon in counter-clockwise order; at least three points. */
  polygon: IAutoMovieDrawingPoint[];
  /** Exact area of {@link polygon} in square metres. */
  area: number;
  /**
   * Material id a finish view fills this region with, or `null`.
   *
   * Resolved from the material bound to the elements realizing the space's
   * boundaries. It is a surface material and not a construction build-up: a
   * material assembly is a separate record from the built environment, a
   * drawing is derived from the environment alone, and the drawing declares
   * that reach as a gap rather than inventing a layer order it cannot see.
   */
  finish: string | null;
}

/** Where an opening mark's geometry came from. */
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
 * @author Samchon
 */
export interface IAutoMovieDrawingOpeningMark {
  /** Opening identity, matching the design's own opening id. */
  opening: string;

  /** Boundary the opening is cut through. */
  boundary: string;

  /** Opening kind, such as `door`, `window`, `arch` or `passage`. */
  kind: string;

  /** Filling element id, or `null` for an open cut. */
  fill: string | null;

  /** Where the geometry below came from. */
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
   */
  polygon: IAutoMovieDrawingPoint[];

  /**
   * Width in metres of whatever {@link basis} says was measured, or `null` when
   * it says `none`.
   *
   * A `profile` mark measures the void; a `fill` mark measures the leaf that
   * stands in one. Reading either as the other is the mistake {@link basis}
   * exists to prevent, so neither is called the void's size here.
   */
  width: number | null;

  /** Height in metres of the same thing, or `null` when `basis` is `none`. */
  height: number | null;
}

/** Whether a pinned target still resolves against the current design. */
export type AutoMovieDrawingTargetStatus = "resolved" | "stale";

/** One dimension as the drawing resolved it. */
export interface IAutoMovieDrawingDimension {
  /** Dimension identity, as authored. */
  id: string;
  /** What the measurement means. */
  measure: "page" | "world";
  /** Whether both ends resolved. */
  status: AutoMovieDrawingTargetStatus;
  /** Page start point, or `null` when stale. */
  from: IAutoMovieDrawingPoint | null;
  /** Page end point, or `null` when stale. */
  to: IAutoMovieDrawingPoint | null;
  /** Measured distance in metres, or `null` when stale. */
  value: number | null;
  /** Exactly why the target no longer resolves, or `null` when resolved. */
  reason: string | null;
}

/** One note as the drawing resolved it. */
export interface IAutoMovieDrawingAnnotation {
  /** Annotation identity, as authored. */
  id: string;
  /** Note text, as authored. */
  text: string;
  /** Whether the target resolved. */
  status: AutoMovieDrawingTargetStatus;
  /** Page position of the target, or `null` when stale. */
  at: IAutoMovieDrawingPoint | null;
  /** Exactly why the target no longer resolves, or `null` when resolved. */
  reason: string | null;
}

/** Whether a derivation is missing entirely or merely had nothing to run on. */
export type AutoMovieDrawingGapStatus = "unsupported" | "not-run";

/**
 * One derivation that produced nothing, and the exact reason.
 *
 * The same shape the render report uses, for the same reason: a drawing that
 * omitted what it could not compute would read as a drawing of a building with
 * no such thing in it. Naming the absence is the only way a sheet can be
 * trusted for what it does show.
 *
 * @author Samchon
 */
export interface IAutoMovieDrawingGap {
  /** What was not derived, as a stable machine-readable subject. */
  subject: string;
  /** Whether the derivation does not exist or merely had no input. */
  status: AutoMovieDrawingGapStatus;
  /** Exactly what is absent, naming the declaration that needed it. */
  reason: string;
  /** Exactly what would make the derivation produce a result. */
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
 * @author Samchon
 */
export interface IAutoMovieDrawing {
  /** Drawing format. */
  version: 1;

  /** Versioned drawing protocol. */
  protocol: "automovie.drawing.v1";

  /** View this drawing answers for. */
  view: string;

  /** Cut and projection convention the view declared. */
  projection: AutoMovieDrawingProjection;

  /** Discipline the view declared. */
  discipline: string;

  /** Scale denominator the view declared. */
  scale: number;

  /** Built environment this drawing was derived from. */
  environment: string;

  /** Page basis the view resolved to. */
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
   */
  extent: IAutoMovieDrawingExtent | null;

  /** Drafted segments, in canonical order. */
  lines: IAutoMovieDrawingLine[];

  /** Logical volume cross-sections, in canonical order; empty for an elevation. */
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
   */
  openings: IAutoMovieDrawingOpeningMark[];

  /** Resolved dimensions, in the order the view authored them. */
  dimensions: IAutoMovieDrawingDimension[];

  /** Resolved notes, in the order the view authored them. */
  annotations: IAutoMovieDrawingAnnotation[];

  /** Derivations this drawing could not perform, in canonical order. */
  gaps: IAutoMovieDrawingGap[];

  /** Digest over the whole record. */
  digest: AutoMovieContentDigest;
}

/** Page bounding box of a drawing's content. */
export interface IAutoMovieDrawingExtent {
  /** Lowest page coordinate on each axis. */
  min: IAutoMovieDrawingPoint;
  /** Highest page coordinate on each axis. */
  max: IAutoMovieDrawingPoint;
}
