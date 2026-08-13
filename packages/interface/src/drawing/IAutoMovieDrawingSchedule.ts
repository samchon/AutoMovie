import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
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

  /**
   * Where the occurrence sits, or `null` when the subject derives no place.
   *
   * A schedule row that says only what a thing is and how many there are is
   * half an index: the requirement asks for location too, and a reviewer
   * choosing what to look at next needs the answer before the geometry. A room
   * row carries one, because a room *is* a place; an opening or connector row
   * does not yet, and the schedule states that as a gap rather than leaving the
   * absence to be read as "nowhere".
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `place` so a schedule row carries the location the schedule requirement asks of every subject.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `place` as the located half of a schedule row for the interior space drawing schedule quantity system contract.
   */
  place: IAutoMovieDrawingSchedulePlace | null;
}

/**
 * Where a scheduled occurrence stands, and what stands with it.
 *
 * This is the part of a room schedule a door schedule never needed. A reviewer
 * asking "what zones exist, what is each one, what is in it" has to get the
 * membership answer from the declaration that owns it — an element and a
 * population each name the one space they occupy — because matching an id
 * prefix against a model answers a different question and answers it wrong: in
 * the `#1902` experiment that draft undercounted a hall of 312 staged things as
 * 204 and produced five consecutive false "this is missing" reports.
 *
 * {@link declared} and {@link content} are deliberately two boxes. The first is
 * how far the zone reaches, the second is where its contents actually are, and
 * reading the first as the second is what put three of four review cameras of
 * `stair-ground` outside the stair tower they were aimed at.
 *
 * Review state is **not** here. A schedule is a pure reading of one design
 * revision — the same environment schedules the same bytes twice — and whether
 * somebody has looked at a zone is a fact about a review, not about the
 * building. It belongs to the review record and joins to this by zone id.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `IAutoMovieDrawingSchedulePlace` as the location, membership and relation the schedule requirement asks a room row to provide.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingSchedulePlace` for the interior space drawing schedule quantity system contract.
 * @author Samchon
 */
export interface IAutoMovieDrawingSchedulePlace {
  /**
   * Building unit that owns the zone.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `building` so a scheduled zone names the building unit it belongs to.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `building` for the interior space drawing schedule quantity system contract.
   */
  building: string;

  /**
   * Owning logical space, or `null` for a building root.
   *
   * Spaces nest, and a flattened index loses the question "which storey is
   * unreviewed", so the hierarchy is carried rather than dissolved.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `parent` so a scheduled zone keeps its place in the space hierarchy.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `parent` for the interior space drawing schedule quantity system contract.
   */
  parent: string | null;

  /**
   * World box of the zone's own declared volume, or `null` when it declares
   * none this derivation can bound.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `declared` as the zone's own stated extent, kept apart from where its contents are.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `declared` for the interior space drawing schedule quantity system contract.
   */
  declared: IAutoMovieDrawingScheduleBox | null;

  /**
   * World box the zone's contents fill, or `null` when nothing stands in it at
   * any depth.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `content` as the measured extent of what stands in the zone rather than of the zone itself.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `content` for the interior space drawing schedule quantity system contract.
   */
  content: IAutoMovieDrawingScheduleBox | null;

  /**
   * What the zone's declared volume claims to be, folded over its descendants.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `fidelity` as the declared state of the zone's volume, which the schedule requirement counts among a row's relevant properties.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `fidelity` for the interior space drawing schedule quantity system contract.
   */
  fidelity: "exact" | "faceted" | "unstated";

  /**
   * Staged node ids in the zone and its descendants, ascending, bounded by
   * {@link AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS}.
   *
   * A compact population contributes its one owner id rather than its members,
   * so a field of 2,392 slates is one entry and not an unbounded expansion.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `contents` so a room row answers what stands in it by declared membership.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `contents` for the interior space drawing schedule quantity system contract.
   */
  contents: string[];

  /**
   * Staged nodes the bound left out.
   *
   * `contents.length` plus this is the zone's full staged population, so the
   * count a reviewer needs is reproducible from a bounded row.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `omittedContents` so the bounded content sample still reports the zone's whole count.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `omittedContents` for the interior space drawing schedule quantity system contract.
   */
  omittedContents: number;

  /**
   * Zones directly joined to this one, ascending.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `adjacent` so a scheduled zone states what it adjoins.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `adjacent` for the interior space drawing schedule quantity system contract.
   */
  adjacent: string[];

  /**
   * Connectors landing in this zone, ascending.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `connectors` so a scheduled zone states what reaches it.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `connectors` for the interior space drawing schedule quantity system contract.
   */
  connectors: string[];
}

/**
 * An axis-aligned world box a schedule row reports.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `IAutoMovieDrawingScheduleBox` as the located extent a schedule row reports.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `IAutoMovieDrawingScheduleBox` for the interior space drawing schedule quantity system contract.
 */
export interface IAutoMovieDrawingScheduleBox {
  /**
   * Lower corner in metres.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `min` as the lower corner of a scheduled extent.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `min` for the interior space drawing schedule quantity system contract.
   */
  min: IAutoMovieVector3;

  /**
   * Upper corner in metres.
   *
   * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Exposes `max` as the upper corner of a scheduled extent.
   * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Types `max` for the interior space drawing schedule quantity system contract.
   */
  max: IAutoMovieVector3;
}
