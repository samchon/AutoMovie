import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";
import { IAutoMovieDrawingGap } from "./IAutoMovieDrawing";

/**
 * Unit one measured quantity is expressed in.
 *
 * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `AutoMovieQuantityUnit` as the portable data boundary for the building exterior schedules quantities requirement.
 * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `AutoMovieQuantityUnit` for the building envelope deliverable quantity invariant system contract.
 */
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
 * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `AutoMovieQuantitySubject` as the portable data boundary for the building exterior schedules quantities requirement.
 * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `AutoMovieQuantitySubject` for the building envelope deliverable quantity invariant system contract.
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
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `AutoMovieQuantityBasis` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `AutoMovieQuantityBasis` for the interior space drawing schedule quantity system contract.
 * @author Samchon
 */
export type AutoMovieQuantityBasis = "exact" | "approximate";

/**
 * One owner's share of one measured subject.
 *
 * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `IAutoMovieQuantityContributor` as the portable data boundary for the building exterior schedules quantities requirement.
 * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `IAutoMovieQuantityContributor` for the building envelope deliverable quantity invariant system contract.
 */
export interface IAutoMovieQuantityContributor {
  /**
   * Design id the quantity is attributed to: a space, opening, kind or model.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `owner` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `owner` for the building envelope deliverable quantity invariant system contract.
   */
  owner: string;

  /**
   * That owner's exact contribution, in the subject's unit.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `value` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `value` for the building envelope deliverable quantity invariant system contract.
   */
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
 * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `IAutoMovieQuantityFinding` as the portable data boundary for the building exterior schedules quantities requirement.
 * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `IAutoMovieQuantityFinding` for the building envelope deliverable quantity invariant system contract.
 * @author Samchon
 */
export interface IAutoMovieQuantityFinding {
  /**
   * Subject this finding answers for.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `subject` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `subject` for the building envelope deliverable quantity invariant system contract.
   */
  subject: AutoMovieQuantitySubject;

  /**
   * Unit of every number in this finding.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `unit` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `unit` for the building envelope deliverable quantity invariant system contract.
   */
  unit: AutoMovieQuantityUnit;

  /**
   * Exact total over every owner, whether or not the bound named it.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `total` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `total` for the building envelope deliverable quantity invariant system contract.
   */
  total: number;

  /**
   * How many owners contributed at all.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `owners` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `owners` for the building envelope deliverable quantity invariant system contract.
   */
  owners: number;

  /**
   * Whether the total is the design's own arithmetic or an approximation.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `basis` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `basis` for the building envelope deliverable quantity invariant system contract.
   */
  basis: AutoMovieQuantityBasis;

  /**
   * Exactly what makes the total approximate, or `null` when it is exact.
   *
   * Never a hedge. It names the specific modelling limit that produced the
   * error, so a reader can decide whether it matters for what they are about to
   * order.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `approximation` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `approximation` for the building envelope deliverable quantity invariant system contract.
   */
  approximation: string | null;

  /**
   * Dominant owners, descending by value then ascending by owner id.
   *
   * Ties break on the id so the list is a property of the design rather than of
   * the order the graph happened to be walked, which is what makes two
   * derivations of one revision produce the same names.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `contributors` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `contributors` for the building envelope deliverable quantity invariant system contract.
   */
  contributors: IAutoMovieQuantityContributor[];

  /**
   * Owners the bound left out.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `omittedOwners` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `omittedOwners` for the building envelope deliverable quantity invariant system contract.
   */
  omittedOwners: number;

  /**
   * Total carried by the owners the bound left out.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `omittedValue` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `omittedValue` for the building envelope deliverable quantity invariant system contract.
   */
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
 * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `IAutoMovieQuantityReport` as the portable data boundary for the building exterior schedules quantities requirement.
 * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `IAutoMovieQuantityReport` for the building envelope deliverable quantity invariant system contract.
 * @author Samchon
 */
export interface IAutoMovieQuantityReport {
  /**
   * Report format.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `version` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `version` for the building envelope deliverable quantity invariant system contract.
   */
  version: 1;

  /**
   * Versioned quantity protocol.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `protocol` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `protocol` for the building envelope deliverable quantity invariant system contract.
   */
  protocol: "automovie.quantity.v1";

  /**
   * Built environment this report was derived from.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `environment` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `environment` for the building envelope deliverable quantity invariant system contract.
   */
  environment: string;

  /**
   * One finding per subject, in the fixed subject order.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `findings` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `findings` for the building envelope deliverable quantity invariant system contract.
   */
  findings: IAutoMovieQuantityFinding[];

  /**
   * Derivations this report could not perform, in canonical order.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `gaps` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `gaps` for the building envelope deliverable quantity invariant system contract.
   */
  gaps: IAutoMovieDrawingGap[];

  /**
   * Digest over the whole record.
   *
   * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities Exposes `digest` as the portable data boundary for the building exterior schedules quantities requirement.
   * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant Types `digest` for the building envelope deliverable quantity invariant system contract.
   */
  digest: AutoMovieContentDigest;
}
