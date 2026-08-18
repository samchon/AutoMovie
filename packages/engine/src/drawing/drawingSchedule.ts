import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltSpace,
  IAutoMovieDrawingGap,
  IAutoMovieDrawingSchedule,
  IAutoMovieDrawingScheduleBox,
  IAutoMovieDrawingSchedulePlace,
  IAutoMovieDrawingScheduleRow,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  builtEnvironmentAdjacentSpaces,
  builtEnvironmentBuildingOfSpace,
  builtEnvironmentSpaceConnectors,
  builtEnvironmentSpaceContentBounds,
  builtEnvironmentSpaceFidelity,
  builtEnvironmentSpaceNodes,
  validateBuiltEnvironment,
} from "../architecture/builtEnvironment";
import {
  autoMovieRenderDigest,
  compareAutoMovieRenderIds,
} from "../render/renderDigest";
import { withArticle } from "../text/article";
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
 * `space` is the room schedule the deliverable requirement names first, and it
 * groups differently from the other two on purpose: a door schedule collapses
 * three hundred identical doors into one type row, while a room schedule lists
 * rooms, because "which zones exist and what is each one" is the question a
 * reviewer asks of a building and a type row cannot answer it.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Lets an authored schedule select the resolved room, opening or connector population it must reconcile with the design.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Closes the derivation input to the three occurrence collections for which canonical grouping and measurement are defined.
 */
export type AutoMovieDrawingScheduleSubject = "space" | "opening" | "connector";

/**
 * Count one design's rooms, openings or connectors.
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
 * A `space` row is that same discipline applied to a room. Its membership is
 * read from `builtEnvironmentSpaceNodes`, which is the declaration an element
 * and a population each make about the one space they occupy, and never from
 * the shape of an id: the id-prefix draft the `#1902` reviewer wrote beside the
 * model instead undercounted a hall of 312 staged things as 204 and turned five
 * consecutive "this is missing" reports into false ones. Its extent is two
 * boxes, the declared volume and the measured contents, because those are
 * different questions and reading the first as the second is what aimed three
 * of four review cameras at a wall.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-schedules Groups the selected design occurrences into stable marks whose identity, counts, location, state, samples, and gaps reconcile with the model.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Validates the environment, derives declared, profile or fill dimensions, canonicalizes rows and omission totals, declares unsupported performance, and hashes the schedule.
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
    subject === "space"
      ? spaceOccurrences(environment)
      : subject === "opening"
        ? openingOccurrences(environment)
        : connectorOccurrences(environment);

  const grouped = new Map<string, IOccurrence[]>();
  for (const occurrence of occurrences) {
    // A room is its own row. Two rooms of one kind and one size are still two
    // rooms a reviewer has to visit separately, so the type collapse that makes
    // a door schedule readable would make a room schedule useless.
    const key = subject === "space" ? occurrence.id : groupKey(occurrence);
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
      place: head.place,
    };
  });

  const gaps: IAutoMovieDrawingGap[] = [];
  const unmeasured = rows.filter((row) => row.basis === "unmeasured");
  if (unmeasured.length !== 0)
    gaps.push({
      // Only an opening or a space can be unmeasured: a connector must state
      // its section one way or the other before the design validates at all.
      subject: `${subject}-geometry`,
      status: "not-run",
      reason:
        subject === "space"
          ? `${unmeasured.reduce((sum, row) => sum + row.count, 0)} space(s) state no volume this schedule can bound as a box, so their nominal size is absent rather than zero`
          : `${unmeasured.reduce((sum, row) => sum + row.count, 0)} ${subject}(s) have no geometry to measure, so their nominal size is absent rather than zero`,
      remedy:
        subject === "space"
          ? "state the space's volume as axis-aligned cells or as a closed shell; a purely semantic container legitimately has none, and its contents are measured either way"
          : "author the opening's profile on a boundary that carries a face, or give it a filling element with geometry",
    });
  gaps.push(
    subject === "space"
      ? {
          // The remaining subjects the deliverable requirement names. Recorded
          // here rather than left to a reader's assumption, because an absent
          // finish row must not be read as an unfinished room.
          subject: "space-fit-out",
          status: "unsupported",
          reason:
            "finish, furniture, fixture, equipment, light and service terminal are not scheduled subjects yet, so a room row states its identity, extent, contents and relations only",
          remedy:
            "schedule those subjects once the design carries them; do not read an absent finish row as an unfinished room",
        }
      : subject === "opening"
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
  if (subject !== "space")
    gaps.push({
      // The requirement asks every subject for a location. A room answers with
      // the space it is; an opening and a connector would answer through their
      // host boundary and their declared stops, and that derivation is not
      // written, so the row's absent place is stated rather than implied.
      subject: `${subject}-location`,
      status: "not-run",
      reason: `${withArticle(subject)} row states type, size and count but no place, so its location must still be read from the design rather than from the schedule`,
      remedy:
        subject === "opening"
          ? "resolve the opening's host boundary to the spaces it separates, then fill the row's place"
          : "resolve the connector's declared stops to their spaces, then fill the row's place",
    });
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
  place: IAutoMovieDrawingSchedulePlace | null;
}

/**
 * Rooms, each located by what the design already declares about it.
 *
 * Nothing here re-derives a fact the built environment answers: membership,
 * content extent, adjacency, connection, ownership and volume fidelity are the
 * environment's own queries, and a schedule that re-implemented any of them
 * would be a second reading able to disagree with the first — the precise
 * failure this whole derivation exists to prevent.
 *
 * The nominal pair is the declared volume's own box, widest horizontal extent
 * against clear height, so a room reads the way a room is described. A space
 * that states no volume, or states one this cannot bound as a box, is
 * `unmeasured` with `null` dimensions rather than a zero-sized room; its
 * contents are still measured, because a semantic container full of things is
 * not an empty one.
 */
const spaceOccurrences = (
  environment: IAutoMovieBuiltEnvironment,
): IOccurrence[] =>
  environment.spaces.map((space) => {
    const declared = declaredSpaceBox(space);
    const nodes = builtEnvironmentSpaceNodes(environment, space.id).sort(
      compareAutoMovieRenderIds,
    );
    const content = builtEnvironmentSpaceContentBounds(environment, space.id);
    const extent =
      declared === null
        ? { width: null, height: null }
        : autoMovieOpeningFillExtent([declared.min, declared.max]);
    return {
      id: space.id,
      kind: space.kind,
      model: null,
      width: extent.width,
      height: extent.height,
      basis: declared === null ? ("unmeasured" as const) : ("profile" as const),
      place: {
        building: builtEnvironmentBuildingOfSpace(environment, space.id),
        parent: space.parent,
        declared,
        content: content === null ? null : roundedBox(content),
        fidelity: builtEnvironmentSpaceFidelity(environment, space.id),
        contents: nodes.slice(0, AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS),
        omittedContents: Math.max(
          0,
          nodes.length - AUTOMOVIE_DRAWING_SCHEDULE_MAX_MEMBERS,
        ),
        adjacent: builtEnvironmentAdjacentSpaces(environment, space.id).sort(
          compareAutoMovieRenderIds,
        ),
        connectors: builtEnvironmentSpaceConnectors(environment, space.id)
          .map((connector) => connector.id)
          .sort(compareAutoMovieRenderIds),
      },
    };
  });

/**
 * The world box a space's own declared volume fills, or `null`.
 *
 * A shell states its vertices, so its box is exact. Cells state half-spaces,
 * and a box follows from them only where every plane faces an axis and every
 * axis is closed on both sides; anything else — a chamfer, a cell left open on
 * one side — is refused rather than approximated, because a room schedule that
 * printed a made-up extent would be read as a measurement.
 */
const declaredSpaceBox = (
  space: IAutoMovieBuiltSpace,
): IAutoMovieDrawingScheduleBox | null => {
  if (space.shell !== undefined) return roundedBox(boxOf(space.shell.vertices));
  if (space.cells.length === 0) return null;
  const corners: IAutoMovieVector3[] = [];
  for (const cell of space.cells) {
    const box = axisAlignedCellBox(cell.planes);
    if (box === null) return null;
    corners.push(box.min, box.max);
  }
  return roundedBox(boxOf(corners));
};

/** The box a cell's half-spaces close, when they are axis-aligned and closed. */
const axisAlignedCellBox = (
  planes: IAutoMovieBuiltSpace["cells"][number]["planes"],
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } | null => {
  const min = { x: -Infinity, y: -Infinity, z: -Infinity };
  const max = { x: Infinity, y: Infinity, z: Infinity };
  for (const plane of planes) {
    const axis = alignedAxis(plane.normal);
    if (axis === null) return null;
    const scale = plane.normal[axis];
    const value = plane.offset / scale;
    if (scale > 0) max[axis] = Math.min(max[axis], value);
    else min[axis] = Math.max(min[axis], value);
  }
  return (["x", "y", "z"] as const).every(
    (axis) => Number.isFinite(min[axis]) && Number.isFinite(max[axis]),
  )
    ? { min, max }
    : null;
};

/** The one axis a normal faces, or `null` when it faces between axes. */
const alignedAxis = (normal: IAutoMovieVector3): "x" | "y" | "z" | null => {
  const facing = (["x", "y", "z"] as const).filter(
    (axis) => Math.abs(normal[axis]) > PLANE_AXIS_EPSILON,
  );
  return facing.length === 1 ? facing[0]! : null;
};

/**
 * How far a plane normal's off-axis component may reach and still be an axis.
 *
 * A cell written by hand states exact unit normals, so this only absorbs the
 * float noise a transformed normal carries; anything a reader would call a
 * chamfer is far outside it.
 */
const PLANE_AXIS_EPSILON = 1e-9;

const boxOf = (
  points: readonly IAutoMovieVector3[],
): { min: IAutoMovieVector3; max: IAutoMovieVector3 } => ({
  min: {
    x: Math.min(...points.map((point) => point.x)),
    y: Math.min(...points.map((point) => point.y)),
    z: Math.min(...points.map((point) => point.z)),
  },
  max: {
    x: Math.max(...points.map((point) => point.x)),
    y: Math.max(...points.map((point) => point.y)),
    z: Math.max(...points.map((point) => point.z)),
  },
});

/** The same box at the drawing's stated precision, so the digest is stable. */
const roundedBox = (box: {
  min: IAutoMovieVector3;
  max: IAutoMovieVector3;
}): IAutoMovieDrawingScheduleBox => ({
  min: roundedPoint(box.min),
  max: roundedPoint(box.max),
});

const roundedPoint = (point: IAutoMovieVector3): IAutoMovieVector3 => ({
  x: roundAutoMovieDrawingScalar(point.x),
  y: roundAutoMovieDrawingScalar(point.y),
  z: roundAutoMovieDrawingScalar(point.z),
});

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
        place: null,
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
        place: null,
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
        place: null,
      };
    return {
      id: opening.id,
      kind: opening.kind,
      model: model.id,
      ...autoMovieOpeningFillExtent(corners),
      basis: "fill",
      place: null,
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
        place: null,
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
      place: null,
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

/**
 * Order two rows by what a reader sorts a schedule on, identity last.
 *
 * The identity tiebreak never fires for a type row — two occurrences agreeing
 * on every column ahead of it share a group key and are one row — but a room
 * row is its own group, so without it two identical rooms would be marked in
 * the order the design happened to list them.
 */
const compareOccurrences = (left: IOccurrence, right: IOccurrence): number =>
  compareAutoMovieRenderIds(left.kind, right.kind) ||
  compareAutoMovieRenderIds(String(left.model), String(right.model)) ||
  compareNullable(left.width, right.width) ||
  compareNullable(left.height, right.height) ||
  compareAutoMovieRenderIds(left.basis, right.basis) ||
  compareAutoMovieRenderIds(left.id, right.id);

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
        canonicalPlace(row.place),
      ].join("|"),
    ),
    ...schedule.gaps.map((gap) =>
      [gap.subject, gap.status, gap.reason, gap.remedy].join("|"),
    ),
  ].join("\n");

/** A row's place, folded into the digest so a moved room changes the bytes. */
const canonicalPlace = (
  place: IAutoMovieDrawingScheduleRow["place"],
): string =>
  place === null
    ? "unplaced"
    : [
        place.building,
        String(place.parent),
        canonicalBox(place.declared),
        canonicalBox(place.content),
        place.fidelity,
        place.contents.join(","),
        String(place.omittedContents),
        place.adjacent.join(","),
        place.connectors.join(","),
      ].join("~");

const canonicalBox = (box: IAutoMovieDrawingScheduleBox | null): string =>
  box === null
    ? "none"
    : [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].join(
        " ",
      );
