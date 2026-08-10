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
 * @author Samchon
 */
export interface IAutoMovieDrawingSchedule {
  /** Schedule format. */
  version: 1;

  /** Versioned schedule protocol. */
  protocol: "automovie.drawing-schedule.v1";

  /** Built environment this schedule was derived from. */
  environment: string;

  /** What is being scheduled, such as `opening`, `space` or `connector`. */
  subject: string;

  /** Type rows, in canonical order. */
  rows: IAutoMovieDrawingScheduleRow[];

  /**
   * Occurrences the design declares for this subject.
   *
   * The row counts sum to exactly this. A discrepancy is not possible by
   * construction, which is the point: the number the schedule prints and the
   * number of things in the model are one number.
   */
  total: number;

  /** Derivations this schedule could not perform, in canonical order. */
  gaps: IAutoMovieDrawingGap[];

  /** Digest over the whole record. */
  digest: AutoMovieContentDigest;
}

/** One scheduled type and every occurrence of it. */
export interface IAutoMovieDrawingScheduleRow {
  /**
   * Deterministic type mark, such as `door-01`.
   *
   * Assigned from the row's position in the canonical order rather than from an
   * authored label, so the same design marks the same type identically on every
   * run and two derivations of one revision can be compared mark by mark.
   */
  mark: string;

  /** Kind shared by every occurrence in this row. */
  kind: string;

  /** Model backing the occurrence, or `null` when it has no visible element. */
  model: string | null;

  /**
   * Nominal width in metres, or `null` when the design proves none.
   *
   * `null` is a statement that nothing in the design answers the question, not
   * a zero-width door. What was measured is stated by {@link basis}.
   */
  width: number | null;

  /** Nominal height in metres, or `null` when the design proves none. */
  height: number | null;

  /** Occurrences of this type. */
  count: number;

  /**
   * Occurrence ids, ascending, bounded by
   * {@link AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS}.
   */
  members: string[];

  /** Occurrences the bound left out; `count` minus `members.length`. */
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
   */
  basis: "profile" | "fill" | "unmeasured";
}
