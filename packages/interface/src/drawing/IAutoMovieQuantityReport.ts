import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";
import { IAutoMovieDrawingGap } from "./IAutoMovieDrawing";

/** Unit one measured quantity is expressed in. */
export type AutoMovieQuantityUnit = "m" | "m2" | "m3" | "count";

/**
 * What a quantity report answers for.
 *
 * A closed list, and every one of them appears in every report. A take-off that
 * printed only the subjects it happened to find something for would read as a
 * building with no openings whenever somebody forgot to author one, so a
 * subject with nothing to measure reports a zero total over zero owners and
 * says so out loud.
 *
 * @author Samchon
 */
export type AutoMovieQuantitySubject =
  | "space-floor-area"
  | "space-volume"
  | "opening-area"
  | "connector-length"
  | "element-count"
  | "opening-count"
  | "model-occurrence-count";

/**
 * Whether a number is the design's own arithmetic or an approximation of it.
 *
 * This is the field that decides whether a quantity can be believed. A convex
 * polygon's area is exact; the volume of a space assembled from overlapping
 * convex cells is not, and a report that printed both as plain numbers would be
 * worse than one that printed neither.
 *
 * @author Samchon
 */
export type AutoMovieQuantityBasis = "exact" | "approximate";

/** One owner's share of one measured subject. */
export interface IAutoMovieQuantityContributor {
  /** Design id the quantity is attributed to: a space, opening, kind or model. */
  owner: string;

  /** That owner's exact contribution, in the subject's unit. */
  value: number;
}

/**
 * Everything the design says about one measured subject.
 *
 * The total is exact and covers every owner. The named owners are bounded by
 * {@link AUTOMOVIE_QUANTITY_MAX_CONTRIBUTORS}, and what the bound left out is
 * counted and summed rather than dropped, so a take-off over a fifty-storey
 * tower is the same size as one over a single room and still adds up. An
 * unbounded list would be a second copy of the model wearing a total, and the
 * one artifact somebody orders material from would become the one nobody
 * reads.
 *
 * @author Samchon
 */
export interface IAutoMovieQuantityFinding {
  /** Subject this finding answers for. */
  subject: AutoMovieQuantitySubject;

  /** Unit of every number in this finding. */
  unit: AutoMovieQuantityUnit;

  /** Exact total over every owner, whether or not the bound named it. */
  total: number;

  /** How many owners contributed at all. */
  owners: number;

  /** Whether the total is the design's own arithmetic or an approximation. */
  basis: AutoMovieQuantityBasis;

  /**
   * Exactly what makes the total approximate, or `null` when it is exact.
   *
   * Never a hedge. It names the specific modelling limit that produced the
   * error, so a reader can decide whether it matters for what they are about to
   * order.
   */
  approximation: string | null;

  /**
   * Dominant owners, descending by value then ascending by owner id.
   *
   * Ties break on the id so the list is a property of the design rather than of
   * the order the graph happened to be walked, which is what makes two
   * derivations of one revision produce the same names.
   */
  contributors: IAutoMovieQuantityContributor[];

  /** Owners the bound left out. */
  omittedOwners: number;

  /** Total carried by the owners the bound left out. */
  omittedValue: number;
}

/**
 * Every quantity the design can currently answer for, and every one it cannot.
 *
 * Quantities come from geometry, not from a bill somebody typed: an area is the
 * area of an authored footprint and a length is the length of an authored
 * route, so a change to the design is a change to the quantity with nothing in
 * between to fall out of date.
 *
 * What the design cannot answer is stated as a gap rather than omitted or
 * defaulted to zero. Material take-off, layer thickness and pattern cut waste
 * all need declarations the design does not carry yet; a report that silently
 * left them out would read as a building that needs no material.
 *
 * @author Samchon
 */
export interface IAutoMovieQuantityReport {
  /** Report format. */
  version: 1;

  /** Versioned quantity protocol. */
  protocol: "automovie.quantity.v1";

  /** Built environment this report was derived from. */
  environment: string;

  /** One finding per subject, in the fixed subject order. */
  findings: IAutoMovieQuantityFinding[];

  /** Derivations this report could not perform, in canonical order. */
  gaps: IAutoMovieDrawingGap[];

  /** Digest over the whole record. */
  digest: AutoMovieContentDigest;
}
