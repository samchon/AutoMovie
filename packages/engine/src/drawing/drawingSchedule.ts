import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawingGap,
  IAutoMovieDrawingSchedule,
  IAutoMovieDrawingScheduleRow,
} from "@automovie/interface";

import { validateBuiltEnvironment } from "../architecture/builtEnvironment";
import {
  autoMovieRenderDigest,
  compareAutoMovieRenderIds,
} from "../render/renderDigest";
import {
  autoMovieOpeningExtent,
  autoMovieOpeningFillExtent,
} from "./drawingOpening";
import {
  autoMovieDrawingPartTriangles,
  autoMovieDrawingRange,
  autoMovieDrawingWorldMatrices,
  roundAutoMovieDrawingScalar,
  transformAutoMovieDrawingTriangles,
} from "./drawingProjection";

/**
 * How many occurrence ids one schedule row may list.
 *
 * A schedule row's job is to say what the type is and how many there are; the
 * ids are there to find one, not to enumerate a tower. Bounding the list is
 * what keeps a schedule over five thousand windows the same size as a schedule
 * over five, and the omitted count is stated so the bound is never mistaken for
 * the total.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Keeps a schedule row readable by listing only a bounded occurrence sample while still reporting its full count and omitted remainder.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Fixes the canonical row member sample at eight identities before the residual population is recorded in `omittedMembers`.
 */
export const AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS = 8;

/**
 * What a schedule counts.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Lets an authored schedule select the resolved opening or connector population it must reconcile with the design.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Closes the derivation input to the two occurrence collections for which canonical grouping and measurement are defined.
 */
export type AutoMovieDrawingScheduleSubject = "opening" | "connector";

/**
 * Count one design's openings or connectors by type.
 *
 * The schedule and the drawing are two readings of one graph, so a door on the
 * plan and a row in the schedule cannot describe different doors: both come
 * from `environment.openings`, and `total` is that array's length by
 * construction. That is the whole point of deriving rather than drafting — a
 * schedule maintained beside a model is wrong the first time either is edited.
 *
 * Nominal dimensions come from the opening's own void where the design authored
 * one, and from the filling element's extent where it did not. The row says
 * which, because a leaf's bounding size is not the hole's and a schedule that
 * printed both as plain numbers would be ordered from. A type with neither
 * reports `unmeasured` with `null` dimensions and the schedule reports the gap;
 * it never prints a zero.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Groups the selected design occurrences by type and measured size into stable marks whose counts, samples, and gaps reconcile with the model.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Validates the environment, derives profile or fill dimensions, canonicalizes rows and omission totals, declares unsupported performance, and hashes the schedule.
 * @author Samchon
 */
export const deriveAutoMovieDrawingSchedule = (props: {
  /** Design the schedule is derived from. */
  environment: IAutoMovieBuiltEnvironment;
  /** What to count. */
  subject: AutoMovieDrawingScheduleSubject;
}): IAutoMovieDrawingSchedule => {
  const { environment, subject } = props;
  const validated = validateBuiltEnvironment({ environment });
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `built environment "${environment.id}" is invalid at ${first.path}: ${first.expected}`,
    );
  }
  const occurrences =
    subject === "opening"
      ? openingOccurrences(environment)
      : connectorOccurrences(environment);

  const grouped = new Map<string, IOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = groupKey(occurrence);
    const bucket = grouped.get(key);
    if (bucket === undefined) grouped.set(key, [occurrence]);
    else bucket.push(occurrence);
  }
  const ordered = [...grouped.values()].sort((left, right) =>
    compareOccurrences(left[0]!, right[0]!),
  );
  const marks = new Map<string, number>();
  const rows: IAutoMovieDrawingScheduleRow[] = ordered.map((bucket) => {
    const head = bucket[0]!;
    const ordinal = (marks.get(head.kind) ?? 0) + 1;
    marks.set(head.kind, ordinal);
    const members = bucket
      .map((occurrence) => occurrence.id)
      .sort(compareAutoMovieRenderIds);
    return {
      mark: `${head.kind}-${String(ordinal).padStart(2, "0")}`,
      kind: head.kind,
      model: head.model,
      width: head.width,
      height: head.height,
      count: bucket.length,
      members: members.slice(0, AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS),
      omittedMembers: Math.max(
        0,
        members.length - AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS,
      ),
      basis: head.basis,
    };
  });

  const gaps: IAutoMovieDrawingGap[] = [];
  const unmeasured = rows.filter((row) => row.basis === "unmeasured");
  if (unmeasured.length !== 0)
    gaps.push({
      // Only an opening can be unmeasured: a connector must state its section
      // one way or the other before the design validates at all.
      subject: `${subject}-geometry`,
      status: "not-run",
      reason: `${unmeasured.reduce((sum, row) => sum + row.count, 0)} ${subject}(s) have no geometry to measure, so their nominal size is absent rather than zero`,
      remedy:
        "author the opening's profile on a boundary that carries a face, or give it a filling element with geometry",
    });
  gaps.push(
    subject === "opening"
      ? {
          subject: "opening-performance",
          status: "unsupported",
          reason:
            "the design carries no fill operation, hardware, fire rating or acoustic rating, so the schedule reports type, size and count only",
          remedy:
            "author the opening's operable state and rated properties, then re-derive the schedule",
        }
      : {
          subject: "traversal-performance",
          status: "unsupported",
          reason:
            "a connector's geometry is scheduled, but passability, reachability, route finding and egress performance are a later stage and were not computed",
          remedy:
            "run a traversal analysis once one exists; do not read a scheduled stair as a stair somebody can climb",
        },
  );
  gaps.sort((left, right) =>
    compareAutoMovieRenderIds(left.subject, right.subject),
  );

  const schedule: Omit<IAutoMovieDrawingSchedule, "digest"> = {
    version: 1,
    protocol: "automovie.drawing-schedule.v1",
    environment: environment.id,
    subject,
    rows,
    total: occurrences.length,
    gaps,
  };
  return { ...schedule, digest: autoMovieRenderDigest(canonical(schedule)) };
};

/** One scheduled thing, reduced to what decides its type. */
interface IOccurrence {
  id: string;
  kind: string;
  model: string | null;
  width: number | null;
  height: number | null;
  basis: IAutoMovieDrawingScheduleRow["basis"];
}

const openingOccurrences = (
  environment: IAutoMovieBuiltEnvironment,
): IOccurrence[] => {
  const matrices = autoMovieDrawingWorldMatrices(environment);
  return environment.openings.map((opening) => {
    const element =
      opening.fill === null
        ? undefined
        : environment.elements.find(
            (candidate) => candidate.id === opening.fill,
          );
    // The opening's own void wins over anything standing in it: only the void
    // is the hole, and a leaf's extent is the leaf's. Validation already
    // refuses a void whose host boundary declares no face, so a stated profile
    // never needs its host re-checked here.
    if (opening.profile !== undefined) {
      const extent = autoMovieOpeningExtent(opening.profile);
      return {
        id: opening.id,
        kind: opening.kind,
        model: element?.model ?? null,
        width: extent.width,
        height: extent.height,
        basis: "profile",
      };
    }
    const model =
      element === undefined
        ? undefined
        : environment.models.find(
            (candidate) => candidate.id === element.model,
          );
    if (element === undefined || model === undefined)
      return {
        id: opening.id,
        kind: opening.kind,
        model: element?.model ?? null,
        width: null,
        height: null,
        basis: "unmeasured",
      };
    const corners = transformAutoMovieDrawingTriangles(
      matrices.get(element.id)!,
      model.parts.flatMap((part) => autoMovieDrawingPartTriangles(model, part)),
    ).flatMap((triangle) => [triangle.a, triangle.b, triangle.c]);
    if (corners.length === 0)
      return {
        id: opening.id,
        kind: opening.kind,
        model: model.id,
        width: null,
        height: null,
        basis: "unmeasured",
      };
    return {
      id: opening.id,
      kind: opening.kind,
      model: model.id,
      ...autoMovieOpeningFillExtent(corners),
      basis: "fill",
    };
  });
};

/**
 * Connectors, sized by the section that governs them.
 *
 * A connector states either a constant pair or a sampled series; where it
 * varies, the schedule reports the narrowest and lowest section, because that
 * is the one a stair or corridor is actually limited by and the average of a
 * passage is a number nothing has to satisfy.
 */
const connectorOccurrences = (
  environment: IAutoMovieBuiltEnvironment,
): IOccurrence[] =>
  environment.connectors.map((connector) => {
    if (connector.width !== undefined && connector.clearHeight !== undefined)
      return {
        id: connector.id,
        kind: connector.kind,
        model: null,
        width: roundAutoMovieDrawingScalar(connector.width),
        height: roundAutoMovieDrawingScalar(connector.clearHeight),
        basis: "profile" as const,
      };
    // Validation already refused a connector that states neither spelling, so
    // the sampled sections are there whenever the constant pair is not.
    const sections = connector.sections!;
    return {
      id: connector.id,
      kind: connector.kind,
      model: null,
      width: roundAutoMovieDrawingScalar(
        autoMovieDrawingRange(sections.map((section) => section.width)).min,
      ),
      height: roundAutoMovieDrawingScalar(
        autoMovieDrawingRange(sections.map((section) => section.clearHeight))
          .min,
      ),
      basis: "profile" as const,
    };
  });

const groupKey = (occurrence: IOccurrence): string =>
  [
    occurrence.kind,
    String(occurrence.model),
    String(occurrence.width),
    String(occurrence.height),
    occurrence.basis,
  ].join("|");

const compareOccurrences = (left: IOccurrence, right: IOccurrence): number =>
  compareAutoMovieRenderIds(left.kind, right.kind) ||
  compareAutoMovieRenderIds(String(left.model), String(right.model)) ||
  compareNullable(left.width, right.width) ||
  compareNullable(left.height, right.height) ||
  compareAutoMovieRenderIds(left.basis, right.basis);

/** Order two optional measurements, with the unmeasured type first. */
const compareNullable = (left: number | null, right: number | null): number =>
  left === right ? 0 : left === null ? -1 : right === null ? 1 : left - right;

const canonical = (
  schedule: Omit<IAutoMovieDrawingSchedule, "digest">,
): string =>
  [
    schedule.protocol,
    schedule.environment,
    schedule.subject,
    String(schedule.total),
    ...schedule.rows.map((row) =>
      [
        row.mark,
        row.kind,
        String(row.model),
        String(row.width),
        String(row.height),
        String(row.count),
        row.members.join(","),
        String(row.omittedMembers),
        row.basis,
      ].join("|"),
    ),
    ...schedule.gaps.map((gap) =>
      [gap.subject, gap.status, gap.reason, gap.remedy].join("|"),
    ),
  ].join("\n");
