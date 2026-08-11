import {
  AutoMovieQuantityBasis,
  AutoMovieQuantitySubject,
  AutoMovieQuantityUnit,
  IAutoMovieBuiltEnvironment,
  IAutoMovieDrawingGap,
  IAutoMovieQuantityContributor,
  IAutoMovieQuantityFinding,
  IAutoMovieQuantityReport,
} from "@automovie/interface";

import {
  builtSpaceShellVolume,
  validateBuiltEnvironment,
} from "../architecture/builtEnvironment";
import { Vector3 } from "../math/Vector3";
import {
  autoMovieRenderDigest,
  compareAutoMovieRenderIds,
} from "../render/renderDigest";
import { footprintArea, surfaceFootprint } from "../space/footprint";
import { autoMovieOpeningArea } from "./drawingOpening";
import {
  autoMovieDrawingCellVolume,
  roundAutoMovieDrawingScalar,
} from "./drawingProjection";

/**
 * How many owners one quantity finding may name.
 *
 * The same bound, for the same reason, as the render report's contributor list:
 * a take-off has to name the few owners worth acting on and count the rest, or
 * the artifact somebody orders material from grows with the building until
 * nobody reads it. What the bound leaves out is counted and summed, never
 * dropped, so the named owners and the total always reconcile.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-quantities-waste Bounds each take-off's named owner sample while preserving the count and value of every omitted contributor.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Sets the canonical contributor-list limit to eight before omitted owners are separately counted and summed.
 */
export const AUTOMOVIE_QUANTITY_MAX_CONTRIBUTORS = 8;

/**
 * Every subject a report answers for, in the order it answers for them.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-quantities-waste Ensures every promised take-off subject receives an ordered finding, including an explicit zero when no owner contributes.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Defines the canonical report order for floor area, volume, opening area, connector length, and occurrence counts.
 */
export const AUTOMOVIE_QUANTITY_SUBJECTS: AutoMovieQuantitySubject[] = [
  "space-floor-area",
  "space-volume",
  "opening-area",
  "connector-length",
  "element-count",
  "opening-count",
  "model-occurrence-count",
];

/** The unit each subject is measured in. */
const UNITS: { [subject in AutoMovieQuantitySubject]: AutoMovieQuantityUnit } =
  {
    "space-floor-area": "m2",
    "space-volume": "m3",
    "opening-area": "m2",
    "connector-length": "m",
    "element-count": "count",
    "opening-count": "count",
    "model-occurrence-count": "count",
  };

/**
 * The exact reason a logical volume's quantity is an approximation.
 *
 * Stated once and attached to the volume finding, so nobody has to find it in a
 * document to know that the number they are about to order concrete against is
 * a sum over cells rather than the volume of their union.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-quantities-waste Discloses that summed convex-cell volumes may double-count overlaps instead of presenting that take-off as an exact union.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Supplies the exact approximation reason attached to cell-sum volume findings while distinguishing exact shell measurement and faceted gaps.
 */
export const AUTOMOVIE_QUANTITY_CELL_UNION_APPROXIMATION =
  "a logical volume stated as convex cells is the union of them, and this is the sum of the cells: overlapping cells are counted once each. A volume stated as a closed boundary shell is measured exactly, and a space that declares itself faceted is reported as a gap of its own";

/**
 * Measure everything the design can answer for, and name everything it cannot.
 *
 * Every number below is arithmetic over authored geometry — a footprint's
 * shoelace area, a void's closed-form arc area, a route's polyline length, a
 * cell's cone decomposition — so a quantity cannot fall out of date with the
 * model it came from. Nothing is looked up, defaulted, or carried over from a
 * previous revision.
 *
 * Three things make the report usable rather than merely populated. Every
 * subject is answered for, always, so an absent quantity is a stated zero
 * rather than a missing row. Each finding says whether its total is exact or an
 * approximation and exactly what makes it approximate. And every quantity the
 * design cannot yet support is a gap, because a take-off that quietly left out
 * material would read as a building that needs none.
 *
 * @author Samchon
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-quantities-waste Derives each take-off value from resolved source geometry, identifies its contributing owners and unit, and names every unavailable or approximate result.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Validates the environment, aggregates each canonical subject, rounds totals, records basis and omissions, sorts gaps, and seals the report with a deterministic digest.
 * @evidence requirements/building-exterior/deliverables.md#building-exterior-schedules-quantities `measureAutoMovieQuantities` derives identified area, volume, length, and count results from the same validated building geometry and marks exact, approximate, and unavailable subjects.
 * @evidence specifications/building-envelope/phases-deliverables-and-validation.md#building-envelope-deliverable-quantity-invariant The report implements stable owner contribution, unit, geometric basis, exactness, omission, and digest fields without claiming every assembly or waste quantity.
 */
export const measureAutoMovieQuantities = (props: {
  /** Design the quantities are measured from. */
  environment: IAutoMovieBuiltEnvironment;
  /** Named-owner bound; defaults to the exported maximum. */
  maxContributors?: number;
}): IAutoMovieQuantityReport => {
  const { environment } = props;
  const bound = props.maxContributors ?? AUTOMOVIE_QUANTITY_MAX_CONTRIBUTORS;
  if (!Number.isSafeInteger(bound) || bound < 1)
    throw new Error(
      `quantity report contributor bound must be a positive safe integer, but was ${bound}`,
    );
  const validated = validateBuiltEnvironment({ environment });
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `built environment "${environment.id}" is invalid at ${first.path}: ${first.expected}`,
    );
  }
  const gaps: IAutoMovieDrawingGap[] = [];
  const measured = new Map<AutoMovieQuantitySubject, Map<string, number>>(
    AUTOMOVIE_QUANTITY_SUBJECTS.map((subject) => [subject, new Map()]),
  );
  const add = (
    subject: AutoMovieQuantitySubject,
    owner: string,
    value: number,
  ): void => {
    const owners = measured.get(subject)!;
    owners.set(owner, (owners.get(owner) ?? 0) + value);
  };

  // Holes are subtracted, because an atrium void is exactly the floor nobody
  // pours: taking the outer ring alone would order concrete for the hole.
  for (const entry of environment.surfaces)
    add(
      "space-floor-area",
      entry.space,
      footprintArea(surfaceFootprint(entry.surface)),
    );

  let unmeasuredCells = 0;
  const faceted: string[] = [];
  for (const space of environment.spaces) {
    if (space.fidelity === "faceted") faceted.push(space.id);
    if (space.shell !== undefined) {
      add("space-volume", space.id, builtSpaceShellVolume(space.shell));
      continue;
    }
    for (const cell of space.cells) {
      const volume = autoMovieDrawingCellVolume(cell.planes);
      if (volume === null) {
        ++unmeasuredCells;
        continue;
      }
      add("space-volume", space.id, volume);
    }
  }
  if (faceted.length !== 0)
    gaps.push({
      subject: "curved-space-boundary",
      status: "unsupported",
      reason: `${faceted.length} logical space(s) (${[...faceted].sort(compareAutoMovieRenderIds).join(", ")}) declare their stated volume faceted, so their measured volume and floor area are the flats they were written as and not the curved region those flats stand for`,
      remedy:
        "read the faceted total as a lower bound on a vaulted or domed region; an exact figure needs a curved boundary primitive this record does not carry",
    });
  if (unmeasuredCells !== 0)
    gaps.push({
      subject: "unbounded-space-cell",
      status: "not-run",
      reason: `${unmeasuredCells} logical cell(s) are unbounded or degenerate, so no volume could be computed for them and they contribute nothing to their space's total`,
      remedy:
        "close each cell with enough half-spaces to bound a solid, or split the region into bounded cells",
    });

  let unprovenOpenings = 0;
  for (const opening of environment.openings) {
    // Validation already refuses a void whose host boundary declares no face,
    // so a stated profile is always placeable and an absent one is the only
    // case left to report.
    if (opening.profile === undefined) {
      ++unprovenOpenings;
      continue;
    }
    add("opening-area", opening.id, autoMovieOpeningArea(opening.profile));
  }
  if (unprovenOpenings !== 0)
    gaps.push({
      subject: "opening-area",
      status: "not-run",
      reason: `${unprovenOpenings} opening(s) declare no void on a boundary face, so the area they remove from their host cannot be measured`,
      remedy:
        "author the opening's profile on a boundary that carries a face, then re-measure",
    });

  for (const connector of environment.connectors) {
    let length = 0;
    for (let index = 1; index < connector.route.length; ++index)
      length += Vector3.length(
        Vector3.subtract(connector.route[index]!, connector.route[index - 1]!),
      );
    add("connector-length", connector.id, length);
  }

  for (const element of environment.elements) {
    add("element-count", element.kind, 1);
    if (element.model !== null) add("model-occurrence-count", element.model, 1);
  }
  for (const opening of environment.openings)
    add("opening-count", opening.kind, 1);

  gaps.push(
    {
      subject: "material-quantity",
      status: "unsupported",
      reason:
        "a material assembly is a separate record from the built environment and this measurement is handed only the environment, so no layer thickness or application area is in reach and no volume or mass of any material can be taken off",
      remedy:
        "extend the measurement to accept the work's material assemblies; a surface material alone cannot produce a take-off",
    },
    {
      subject: "pattern-cut-waste",
      status: "unsupported",
      reason:
        "cut waste is a property of a module layout over a bounded area, and a surface pattern is a separate record this measurement is not handed",
      remedy:
        "extend the measurement to accept the work's surface patterns, then count the offcuts each bounded area produces",
    },
    {
      subject: "opening-deduction",
      status: "unsupported",
      reason:
        "an opening's own area is measured, but nothing deducts it from the boundary or finish it is cut through, because no boundary or finish area is measured yet",
      remedy:
        "measure boundary and finish areas, then subtract the openings each one hosts",
    },
    {
      subject: "developed-surface-area",
      status: "unsupported",
      reason:
        "floor areas are plan footprint areas; the developed area of a sloped, ramped or relief patch is larger and was not computed",
      remedy:
        "integrate the surface's own height rule over its footprint once a developed-area measure exists",
    },
    {
      subject: "surface-identity",
      status: "unsupported",
      reason:
        "a support patch is attributed to its logical space, not to itself: the design binds a surface to a space without a work-unique id for the binding, so two patches of one space cannot be told apart in a take-off",
      remedy:
        "give the space-to-surface binding its own stable id, then attribute floor area per patch",
    },
  );
  gaps.sort((left, right) =>
    compareAutoMovieRenderIds(left.subject, right.subject),
  );

  const findings = AUTOMOVIE_QUANTITY_SUBJECTS.map((subject) =>
    finish(subject, measured.get(subject)!, bound),
  );
  const report: Omit<IAutoMovieQuantityReport, "digest"> = {
    version: 1,
    protocol: "automovie.quantity.v1",
    environment: environment.id,
    findings,
    gaps,
  };
  return { ...report, digest: autoMovieRenderDigest(canonical(report)) };
};

/**
 * Turn one subject's owner tally into its bounded finding.
 *
 * The total is summed over every owner before the bound is applied, so naming
 * fewer owners never changes the number somebody orders against; the omitted
 * count and omitted value are what let a reader reconcile the two.
 */
const finish = (
  subject: AutoMovieQuantitySubject,
  owners: ReadonlyMap<string, number>,
  bound: number,
): IAutoMovieQuantityFinding => {
  const ordered: IAutoMovieQuantityContributor[] = [...owners.entries()]
    .map(([owner, value]) => ({
      owner,
      value: roundAutoMovieDrawingScalar(value),
    }))
    .sort(
      (left, right) =>
        right.value - left.value ||
        compareAutoMovieRenderIds(left.owner, right.owner),
    );
  const omitted = ordered.slice(bound);
  const basis: AutoMovieQuantityBasis =
    subject === "space-volume" ? "approximate" : "exact";
  return {
    subject,
    unit: UNITS[subject],
    total: roundAutoMovieDrawingScalar(
      ordered.reduce((sum, entry) => sum + entry.value, 0),
    ),
    owners: ordered.length,
    basis,
    approximation:
      basis === "approximate"
        ? AUTOMOVIE_QUANTITY_CELL_UNION_APPROXIMATION
        : null,
    contributors: ordered.slice(0, bound),
    omittedOwners: omitted.length,
    omittedValue: roundAutoMovieDrawingScalar(
      omitted.reduce((sum, entry) => sum + entry.value, 0),
    ),
  };
};

const canonical = (report: Omit<IAutoMovieQuantityReport, "digest">): string =>
  [
    report.protocol,
    report.environment,
    ...report.findings.map((finding) =>
      [
        finding.subject,
        finding.unit,
        String(finding.total),
        String(finding.owners),
        finding.basis,
        String(finding.approximation),
        ...finding.contributors.map(
          (contributor) => `${contributor.owner}=${contributor.value}`,
        ),
        String(finding.omittedOwners),
        String(finding.omittedValue),
      ].join("|"),
    ),
    ...report.gaps.map((gap) =>
      [gap.subject, gap.status, gap.reason, gap.remedy].join("|"),
    ),
  ].join("\n");
