import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * What a view does to the design before it draws it.
 *
 * A plan, a reflected ceiling plan, a section and an elevation are not four
 * drawing kinds with four algorithms; they are one orthographic projection with
 * two decisions: where the cut plane is, and which side of it survives. Naming
 * them separately here is what lets a derivation state the drafting convention
 * it is honouring rather than leaving the reader to infer it from a normal.
 *
 * - `plan` looks down. Material above the cut is removed, what the plane passes
 *   through is drawn `cut`, and what lies below is drawn `projected`.
 * - `reflected-ceiling-plan` looks up. Material below the cut is removed and the
 *   ceiling above it is drawn. The page basis is mirrored so a coffer at a
 *   world point lands on the same page point it occupies in the plan, which is
 *   exactly what "reflected" has always meant: the ceiling as it would appear
 *   in a mirror laid on the floor, so the two drawings can be read against each
 *   other.
 * - `section` cuts on a vertical plane and keeps what is beyond it.
 * - `elevation` has no cut at all. Nothing is removed and nothing is `cut`; the
 *   origin only fixes where the page origin sits on the picture plane.
 *
 * @author Samchon
 */
export type AutoMovieDrawingProjection =
  | "plan"
  | "reflected-ceiling-plan"
  | "elevation"
  | "section";

/**
 * How one drawing is taken from one design.
 *
 * This record is a **question asked of the design**, never a second copy of it.
 * Nothing here holds geometry, dimensions or names of its own: a view states a
 * cut plane, a direction, a scale, a filter and a pen, and every line, area and
 * quantity in the resulting drawing is derived from the built environment the
 * view is applied to. That is the whole reason drawings live in this package
 * instead of being drafted beside the model — a hand-drafted sheet and a 3D
 * design disagree the moment either one moves, and a view cannot disagree with
 * the thing it is a projection of.
 *
 * It is also the opposite direction of travel from
 * {@link IAutoMovieDesignReference}. An observed plan image is evidence the
 * design cites; a derived drawing is output the design produces. Neither may be
 * read back as the other, and a drawing never becomes a source of truth.
 *
 * @author Samchon
 */
export interface IAutoMovieDrawingView {
  /** Stable view identity within the production. */
  id: string;

  /** Cut and projection convention this view follows. */
  projection: AutoMovieDrawingProjection;

  /**
   * Open discipline label such as `architectural`, `finish`, `ceiling`,
   * `furniture`, `lighting` or `mechanical`.
   *
   * Open rather than closed for the same reason element kinds are: a discipline
   * a catalogue never anticipated must be expressible as a filter over the same
   * design rather than as a new drawing type nobody can add.
   */
  discipline: string;

  /**
   * World point the cut plane passes through, and the page origin.
   *
   * For a `plan` only the height matters; for a `section` only the offset along
   * the view direction does. The remaining components move the page origin,
   * which is what lets two views of the same building share a coordinate
   * origin.
   */
  origin: IAutoMovieVector3;

  /**
   * Direction the view looks, from the viewer into the design. Must be
   * non-zero.
   *
   * A plan looks along `-Y`, a reflected ceiling plan along `+Y`, and an
   * elevation or section along any horizontal direction. Nothing forbids an
   * oblique direction: an axonometric-style projection is the same math.
   */
  direction: IAutoMovieVector3;

  /**
   * Page-up hint. Must be non-zero and not parallel to {@link direction}.
   *
   * The hint is re-orthogonalized against the view direction, so an author may
   * write the nearest cardinal axis rather than an exact in-plane vector. A
   * plan conventionally writes `-Z`, so world north runs up the page; an
   * elevation writes `+Y`.
   */
  up: IAutoMovieVector3;

  /** Drawing scale denominator: `50` means 1:50. Must be finite and positive. */
  scale: number;

  /**
   * How far past the cut plane the view reaches, in metres, or `null` for no
   * bound.
   *
   * Geometry entirely beyond this depth is drawn `hidden` rather than dropped,
   * because a footing under a slab is a thing the drawing has to be able to say
   * quietly instead of not saying at all.
   */
  depth: number | null;

  /**
   * How far back toward the viewer overhead geometry is still drawn, in metres,
   * or `null` to draw none.
   *
   * Material the cut removed is not simply gone: a beam, a mezzanine edge or a
   * wall cabinet above the cut is drawn `overhead` within this band, which is
   * the dashed convention every floor plan uses.
   */
  overhead: number | null;

  /**
   * Logical spaces this view is restricted to, descendants included. Empty
   * includes every space.
   *
   * An element outside every listed space is dropped. A separation is kept when
   * either of the spaces it divides is listed, because a party wall belongs to
   * both of the rooms on its sides and neither sheet may lose it to the order
   * the design happened to name them in.
   *
   * A name the design does not declare selects nothing and is reported as a
   * gap. A filter is a reference into the design's own space graph, so a
   * dangling one is a mistake rather than a narrow sheet, and a drawing says so
   * instead of coming back blank.
   */
  spaces: string[];

  /**
   * Element kinds this view draws. Empty draws every kind.
   *
   * This is what makes a discipline view a filter rather than a separate model:
   * a mechanical view lists the kinds its discipline owns and gets the same
   * geometry kernel every other view uses.
   *
   * It decides linework and nothing else. A view's opening marks are bounded by
   * {@link spaces} alone, so a lighting plan of a room still answers for that
   * room's doors instead of reporting a room with none.
   */
  elementKinds: string[];

  /** Dimensions this view draws, in the order it draws them. */
  dimensions: IAutoMovieDrawingDimensionSpec[];

  /** Notes this view draws, in the order it draws them. */
  annotations: IAutoMovieDrawingAnnotationSpec[];

  /** Pen weights, dash patterns and text height this view is drawn with. */
  style: IAutoMovieDrawingStyle;
}

/**
 * Which geometric feature of the design an annotation or dimension is pinned
 * to.
 *
 * A note that says "2.4 m" beside a wall is a lie the moment the wall moves. A
 * note pinned to a feature is re-derived from the design every time the drawing
 * is taken, so it either moves with the wall or says out loud that it could not
 * find it. Both outcomes are correct; a stale number that still looks right is
 * the only wrong one.
 *
 * @author Samchon
 */
export interface IAutoMovieDrawingFeature {
  /** Building element the feature belongs to. */
  element: string;

  /** Model part within the element, or `null` for the element's whole geometry. */
  part: string | null;

  /** Which family of feature is addressed. */
  kind: AutoMovieDrawingFeatureKind;

  /**
   * Index into the addressed family, in the engine's canonical order.
   *
   * Vertices, edges and faces are addressed in a canonical order derived from
   * the geometry itself rather than in the order the model happened to emit
   * them, so reordering a model's parts does not move every note on every
   * sheet. For `axis` this is `0`, `1` or `2` for the element's local X, Y or
   * Z; for `centroid` it is ignored and must be `0`.
   */
  index: number;

  /**
   * Feature count the target was authored against, or `null` to skip the check.
   *
   * This is what separates "the wall moved" from "the wall is a different
   * wall". A positional index re-resolves happily against changed geometry,
   * which is the point; but if the count changed, the index now addresses a
   * different feature, and the target is reported stale rather than silently
   * relocated onto whichever feature inherited the number.
   */
  count: number | null;
}

/** Family of geometric feature an annotation target addresses. */
export type AutoMovieDrawingFeatureKind =
  | "vertex"
  | "edge"
  | "face"
  | "axis"
  | "centroid";

/** What a dimension measures, and between which two features. */
export interface IAutoMovieDrawingDimensionSpec {
  /** Stable dimension identity within the view. */
  id: string;

  /** Feature the measurement starts at. */
  from: IAutoMovieDrawingFeature;

  /** Feature the measurement ends at. */
  to: IAutoMovieDrawingFeature;

  /**
   * `page` measures the projected distance on the drawing; `world` measures the
   * true 3D distance.
   *
   * A plan dimension across a sloped ramp is a different number in each, and a
   * drawing that could not say which one it meant would be unusable for setting
   * out.
   */
  measure: "page" | "world";
}

/** A note pinned to one feature of the design. */
export interface IAutoMovieDrawingAnnotationSpec {
  /** Stable annotation identity within the view. */
  id: string;

  /** Note text, drawn as authored. */
  text: string;

  /** Feature the note is pinned to. */
  target: IAutoMovieDrawingFeature;
}

/** One drafted line's relation to the cut plane and the view depth. */
export type AutoMovieDrawingRole = "cut" | "projected" | "overhead" | "hidden";

/** Stroke width in page millimetres, per line role. */
export type IAutoMovieDrawingWeights = {
  [role in AutoMovieDrawingRole]: number;
};

/** Dash pattern in page millimetres, per line role; an empty array is solid. */
export type IAutoMovieDrawingDashes = {
  [role in AutoMovieDrawingRole]: number[];
};

/**
 * The pen a view is drawn with, in page millimetres rather than model metres.
 *
 * Line weight is the one part of a drawing that is measured on the paper and
 * not in the world: a cut wall reads as a cut wall because its stroke is heavy
 * at every scale, so a weight expressed in metres would thin out as the scale
 * denominator grew. Keeping the four roles' weights and dashes as authored
 * numbers, rather than a named house style, is the difference between shipping
 * a capability and shipping somebody's title block.
 *
 * @author Samchon
 */
export interface IAutoMovieDrawingStyle {
  /** Stroke width per role, in page millimetres. Each must be positive. */
  weights: IAutoMovieDrawingWeights;

  /**
   * Dash pattern per role, in page millimetres. Each entry must be positive; an
   * empty array draws a solid line.
   */
  dashes: IAutoMovieDrawingDashes;

  /** Annotation and dimension text height in page millimetres. Positive. */
  textHeight: number;
}
