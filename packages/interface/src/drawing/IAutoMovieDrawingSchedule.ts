import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";
import { IAutoMovieDrawingGap } from "./IAutoMovieDrawing";

/**
 * A schedule: the same design counted instead of drawn.
 *
 * A door schedule and a floor plan disagree the moment either is maintained by
 * hand, so this is derived from exactly the graph the plan is derived from. The
 * consequence the acceptance cares about is arithmetic rather than aesthetic:
 * {@link total} is the number of scheduled occurrences in the design, and the
 * row counts sum to it, so a schedule cannot quietly lose or invent a door.
 *
 * Rows are grouped by type, which is what a schedule is for — nobody wants
 * three hundred identical rows — and each row names a bounded sample of its
 * members with the remainder counted. That bound is what keeps a schedule over
 * a tower the same size as a schedule over a room.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingSchedule` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingSchedule` for the interior space drawing schedule quantity system contract.
 * @author Samchon
 */
export interface IAutoMovieDrawingSchedule {
  /**
   * Schedule format.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `version` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `version` for the interior space drawing schedule quantity system contract.
   */
  version: 1;

  /**
   * Versioned schedule protocol.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `protocol` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `protocol` for the interior space drawing schedule quantity system contract.
   */
  protocol: "automovie.drawing-schedule.v1";

  /**
   * Built environment this schedule was derived from.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `environment` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `environment` for the interior space drawing schedule quantity system contract.
   */
  environment: string;

  /**
   * What is being scheduled, such as `opening`, `space` or `connector`.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `subject` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `subject` for the interior space drawing schedule quantity system contract.
   */
  subject: string;

  /**
   * Type rows, in canonical order.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `rows` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `rows` for the interior space drawing schedule quantity system contract.
   */
  rows: IAutoMovieDrawingScheduleRow[];

  /**
   * Occurrences the design declares for this subject.
   *
   * The row counts sum to exactly this. A discrepancy is not possible by
   * construction, which is the point: the number the schedule prints and the
   * number of things in the model are one number.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `total` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `total` for the interior space drawing schedule quantity system contract.
   */
  total: number;

  /**
   * Derivations this schedule could not perform, in canonical order.
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
 * One scheduled type and every occurrence of it.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `IAutoMovieDrawingScheduleRow` as the portable data boundary for the interior drawing views requirement.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingScheduleRow` for the interior space drawing schedule quantity system contract.
 */
export interface IAutoMovieDrawingScheduleRow {
  /**
   * Deterministic type mark, such as `door-01`.
   *
   * Assigned from the row's position in the canonical order rather than from an
   * authored label, so the same design marks the same type identically on every
   * run and two derivations of one revision can be compared mark by mark.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `mark` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `mark` for the interior space drawing schedule quantity system contract.
   */
  mark: string;

  /**
   * Kind shared by every occurrence in this row.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `kind` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `kind` for the interior space drawing schedule quantity system contract.
   */
  kind: string;

  /**
   * Model backing the occurrence, or `null` when it has no visible element.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `model` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `model` for the interior space drawing schedule quantity system contract.
   */
  model: string | null;

  /**
   * Nominal width in metres, or `null` when the design proves none.
   *
   * `null` is a statement that nothing in the design answers the question, not
   * a zero-width door. What was measured is stated by {@link basis}.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `width` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `width` for the interior space drawing schedule quantity system contract.
   */
  width: number | null;

  /**
   * Nominal height in metres, or `null` when the design proves none.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `height` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `height` for the interior space drawing schedule quantity system contract.
   */
  height: number | null;

  /**
   * Occurrences of this type.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `count` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `count` for the interior space drawing schedule quantity system contract.
   */
  count: number;

  /**
   * Occurrence ids, ascending, bounded by
   * {@link AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS}.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `members` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `members` for the interior space drawing schedule quantity system contract.
   */
  members: string[];

  /**
   * Occurrences the bound left out; `count` minus `members.length`.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `omittedMembers` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `omittedMembers` for the interior space drawing schedule quantity system contract.
   */
  omittedMembers: number;

  /**
   * What {@link width} and {@link height} were measured from.
   *
   * `profile` is the thing itself: an opening's own void on its host boundary,
   * or a connector's own declared section. `fill` is a stand-in — the filling
   * element's extent, which is a door leaf's size and not the hole's, and is
   * the best a design that authored no void can offer. `unmeasured` is neither,
   * and the dimensions are absent rather than zero.
   *
   * Grouping is by basis as well as by size, so a type measured from a void and
   * a type measured from a leaf never merge into one row that means both.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Exposes `basis` as the portable data boundary for the interior drawing views requirement.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `basis` for the interior space drawing schedule quantity system contract.
   */
  basis: "profile" | "fill" | "unmeasured";
}
