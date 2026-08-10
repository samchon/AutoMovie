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

import { validateBuiltEnvironment } from "../architecture/builtEnvironment";
import { Vector3 } from "../math/Vector3";
import {
  autoMovieRenderDigest,
  compareAutoMovieRenderIds,
} from "../render/renderDigest";
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
 */
export const AUTOMOVIE_QUANTITY_MAX_CONTRIBUTORS = 8;

/** Every subject a report answers for, in the order it answers for them. */
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
 */
export const AUTOMOVIE_QUANTITY_CELL_UNION_APPROXIMATION =
  "a logical volume is the union of its convex cells, and this is the sum of the cells: overlapping cells are counted once each, and a curved or holed boundary is only faceted by the cells that approximate it";

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

  for (const entry of environment.surfaces)
    add("space-floor-area", entry.space, footprintArea(entry.surface.polygon));

  let unmeasuredCells = 0;
  for (const space of environment.spaces)
    for (const cell of space.cells) {
      const volume = autoMovieDrawingCellVolume(cell.planes);
      if (volume === null) {
        ++unmeasuredCells;
        continue;
      }
      add("space-volume", space.id, volume);
    }
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

/** Shoelace area of a footprint on the ground plan; `y` is deliberately ignored. */
const footprintArea = (
  polygon: readonly { x: number; z: number }[],
): number => {
  let sum = 0;
  for (let index = 0; index < polygon.length; ++index) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    sum += current.x * next.z - next.x * current.z;
  }
  return Math.abs(sum) / 2;
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
