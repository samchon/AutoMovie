import {
  IAutoMovieFluidDomain,
  IAutoMovieValidation,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";
import { fluidCourantNumber } from "./shallowWater";

/**
 * Cells one domain may hold, so a lattice cannot silently cost a gigabyte.
 *
 * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budget-refusal Bounds lattice admission with an explicit cell ceiling.
 * @evidence specifications/simulation-effects-and-sound/budget-admission.md#effect-budget-refusal-and-compatibility Defines the compatible maximum accepted lattice population.
 */
export const FLUID_MAX_CELLS = 65_536;

/**
 * Absolute steps one seek may integrate.
 *
 * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budget-refusal Bounds seek reconstruction before unbounded integration begins.
 * @evidence specifications/simulation-effects-and-sound/budget-admission.md#effect-budget-refusal-and-compatibility Defines the compatible maximum seek workload.
 */
export const FLUID_MAX_STEPS = 100_000;

/**
 * Sources, and separately drains, one domain may declare.
 *
 * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budget-refusal Bounds declared flow work before execution.
 * @evidence specifications/simulation-effects-and-sound/budget-admission.md#effect-budget-refusal-and-compatibility Fixes the supported source and drain population ceiling.
 */
export const FLUID_MAX_FLOWS = 256;

/**
 * Spray emitters one domain may declare.
 *
 * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-budget-refusal Bounds decorative emitter work independently of the conserved solve.
 * @evidence specifications/simulation-effects-and-sound/budget-admission.md#effect-budget-refusal-and-compatibility Fixes the supported spray-emitter population ceiling.
 */
export const FLUID_MAX_SPRAYS = 32;

/**
 * Simultaneously live particles one emitter may hold.
 *
 * @evidence requirements/effects-and-simulation/particles-and-emission.md#effects-particle-refusal Refuses an emitter whose live population exceeds the bounded tier.
 * @evidence specifications/simulation-effects-and-sound/particles-fire-and-atmosphere.md#particle-fire-refusal-and-claim-boundary Defines the maximum supported decorative spray population.
 */
export const FLUID_MAX_SPRAY_PARTICLES = 4_096;

const BOUNDARY_KINDS = new Set(["wall", "open"]);
const EDGES = ["xMin", "xMax", "zMin", "zMax"] as const;

/**
 * Validate a fluid domain's lattice, budgets, stability, and declared flows.
 *
 * The point of the pass is that a domain which survives it can be integrated
 * without the solver second-guessing its own input: the arrays are the right
 * length, no depth is negative or deeper than the design depth the Courant
 * number was checked against, no source pours into solid matter, and the
 * explicit step is actually stable. A domain that fails is refused with the
 * path of every offending field, never quietly clamped — a clamped basin is a
 * basin whose author was told nothing and whose frames changed anyway.
 *
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-refusal Refuses invalid lattice, stability, boundary, and flow declarations explicitly.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#world-coupling-invalidation-and-refusal Produces addressed failures before a fluid domain joins the world solve.
 * @author Samchon
 */
export const validateFluidDomain = (props: {
  domain: IAutoMovieFluidDomain;
}): IAutoMovieValidation => {
  const { domain } = props;
  const out = new ViolationCollector();
  const root = "$input";

  if (domain.id.trim().length === 0)
    out.push(
      "type",
      `${root}.id`,
      "fluid domain id must be non-empty",
      domain.id,
    );
  if (domain.version !== 1)
    out.push(
      "type",
      `${root}.version`,
      `fluid domain schema version must be 1, but was ${String(domain.version)}`,
      domain.version,
    );
  if (domain.units !== "meter")
    out.push(
      "type",
      `${root}.units`,
      `fluid domain units must be "meter", but was ${String(domain.units)}`,
      domain.units,
    );

  const columns = domain.grid.columns;
  const rows = domain.grid.rows;
  integer(out, `${root}.grid.columns`, "grid columns", columns, 1, Infinity);
  integer(out, `${root}.grid.rows`, "grid rows", rows, 1, Infinity);
  numeric(
    out,
    `${root}.grid.cellX`,
    "cell size x",
    domain.grid.cellX,
    0,
    true,
    Infinity,
  );
  numeric(
    out,
    `${root}.grid.cellZ`,
    "cell size z",
    domain.grid.cellZ,
    0,
    true,
    Infinity,
  );
  for (const axis of ["x", "y", "z"] as const)
    numeric(
      out,
      `${root}.grid.origin.${axis}`,
      `grid origin ${axis}`,
      domain.grid.origin[axis],
      -Infinity,
      false,
      Infinity,
    );
  const cells = columns * rows;
  // Finite rather than safe-integer: a 2³⁰ × 2³⁰ lattice counts 2⁶⁰ cells,
  // which is past `Number.MAX_SAFE_INTEGER`, and a guard that skipped exactly
  // the grids too large to count would let the only ones nobody can afford
  // past the one budget written to refuse them. A non-finite product means
  // `columns` or `rows` is itself unusable and has already been named.
  if (Number.isFinite(cells) && cells > FLUID_MAX_CELLS)
    out.push(
      "range",
      `${root}.grid`,
      `fluid lattice must hold at most ${FLUID_MAX_CELLS} cells, but declared ${cells}`,
      cells,
      cells - FLUID_MAX_CELLS,
    );

  numeric(
    out,
    `${root}.solver.fixedStepSeconds`,
    "fixed step",
    domain.solver.fixedStepSeconds,
    0,
    true,
    Infinity,
  );
  numeric(
    out,
    `${root}.solver.gravity`,
    "gravity",
    domain.solver.gravity,
    0,
    true,
    Infinity,
  );
  numeric(
    out,
    `${root}.solver.drag`,
    "drag",
    domain.solver.drag,
    0,
    false,
    Infinity,
  );
  numeric(
    out,
    `${root}.solver.dryDepth`,
    "dry depth",
    domain.solver.dryDepth,
    0,
    false,
    Infinity,
  );
  numeric(
    out,
    `${root}.solver.referenceDepth`,
    "reference depth",
    domain.solver.referenceDepth,
    0,
    true,
    Infinity,
  );
  integer(
    out,
    `${root}.solver.maxSteps`,
    "max steps",
    domain.solver.maxSteps,
    1,
    FLUID_MAX_STEPS,
  );

  const courant = fluidCourantNumber(domain);
  if (Number.isFinite(courant) && courant > 1)
    out.push(
      "range",
      `${root}.solver.fixedStepSeconds`,
      `the explicit shallow-water step is stable only while dt·sqrt(g·referenceDepth)·sqrt(1/dx² + 1/dz²) <= 1, but the Courant number is ${courant}`,
      domain.solver.fixedStepSeconds,
      courant - 1,
    );

  for (const edge of EDGES)
    if (!BOUNDARY_KINDS.has(domain.boundaries[edge]))
      out.push(
        "type",
        `${root}.boundaries.${edge}`,
        `boundary must be "wall" or "open", but was ${String(domain.boundaries[edge])}`,
        domain.boundaries[edge],
      );

  length(out, `${root}.bed`, "bed", domain.bed.length, cells);
  length(out, `${root}.depth`, "depth", domain.depth.length, cells);
  length(out, `${root}.solid`, "solid", domain.solid.length, cells);
  domain.bed.forEach((value, index) =>
    numeric(
      out,
      `${root}.bed[${index}]`,
      "bed elevation",
      value,
      -Infinity,
      false,
      Infinity,
    ),
  );
  domain.depth.forEach((value, index) => {
    numeric(
      out,
      `${root}.depth[${index}]`,
      "water depth",
      value,
      0,
      false,
      domain.solver.referenceDepth,
    );
    if (domain.solid[index] === true && value !== 0)
      out.push(
        "type",
        `${root}.depth[${index}]`,
        "a solid cell must hold no water",
        value,
      );
  });
  // A cell is solid or it is not, and the two readers of this flag ask the
  // question in opposite directions: the solver blocks a face when the cell
  // `=== true`, the surface draws a quad when it `=== false`. A value that is
  // neither answers no to both, so the water would flow through a pier the
  // renderer refuses to draw around. Refusing the flag here is what keeps the
  // solve and the surface one statement.
  domain.solid.forEach((value, index) => {
    if (typeof value !== "boolean")
      out.push(
        "type",
        `${root}.solid[${index}]`,
        "a solidity flag must be a boolean",
        value,
      );
  });
  count(
    out,
    `${root}.sources`,
    "sources",
    domain.sources.length,
    FLUID_MAX_FLOWS,
  );
  const sourceIds = new Set<string>();
  domain.sources.forEach((source, index) => {
    const path = `${root}.sources[${index}]`;
    identity(out, path, "source", source.id, sourceIds);
    site(out, path, domain, source.column, source.row);
    numeric(
      out,
      `${path}.flowRate`,
      "source flow rate",
      source.flowRate,
      0,
      false,
      Infinity,
    );
    window(out, path, source.start, source.end);
  });

  count(out, `${root}.drains`, "drains", domain.drains.length, FLUID_MAX_FLOWS);
  const drainIds = new Set<string>();
  domain.drains.forEach((drain, index) => {
    const path = `${root}.drains[${index}]`;
    identity(out, path, "drain", drain.id, drainIds);
    site(out, path, domain, drain.column, drain.row);
    numeric(
      out,
      `${path}.flowRate`,
      "drain flow rate",
      drain.flowRate,
      0,
      false,
      Infinity,
    );
    numeric(
      out,
      `${path}.sillLevel`,
      "drain sill level",
      drain.sillLevel,
      -Infinity,
      false,
      Infinity,
    );
    window(out, path, drain.start, drain.end);
  });

  count(
    out,
    `${root}.sprays`,
    "spray emitters",
    domain.sprays.length,
    FLUID_MAX_SPRAYS,
  );
  const sprayIds = new Set<string>();
  domain.sprays.forEach((spray, index) => {
    const path = `${root}.sprays[${index}]`;
    identity(out, path, "spray emitter", spray.id, sprayIds);
    site(out, path, domain, spray.column, spray.row);
    numeric(out, `${path}.rate`, "spray rate", spray.rate, 0, true, Infinity);
    numeric(
      out,
      `${path}.lifetime`,
      "spray lifetime",
      spray.lifetime,
      0,
      true,
      Infinity,
    );
    numeric(
      out,
      `${path}.speed`,
      "spray speed",
      spray.speed,
      0,
      false,
      Infinity,
    );
    numeric(out, `${path}.spread`, "spray spread", spray.spread, 0, false, 1);
    numeric(
      out,
      `${path}.size`,
      "spray particle size",
      spray.size,
      0,
      true,
      Infinity,
    );
    numeric(
      out,
      `${path}.lodDistance`,
      "spray LOD distance",
      spray.lodDistance,
      0,
      true,
      Infinity,
    );
    integer(
      out,
      `${path}.maxParticles`,
      "spray particle cap",
      spray.maxParticles,
      1,
      FLUID_MAX_SPRAY_PARTICLES,
    );
    if (!Number.isSafeInteger(spray.seed))
      out.push(
        "type",
        `${path}.seed`,
        "spray seed must be a safe integer",
        spray.seed,
      );
    const axis = spray.direction;
    if (
      !Number.isFinite(axis.x) ||
      !Number.isFinite(axis.y) ||
      !Number.isFinite(axis.z) ||
      axis.x * axis.x + axis.y * axis.y + axis.z * axis.z === 0
    )
      out.push(
        "type",
        `${path}.direction`,
        "spray direction must be a finite non-zero vector",
        axis,
      );
  });

  return out.toValidation();
};

/** A finite scalar inside `[min, max]`, or `(min, max]` when `exclusive`. */
const numeric = (
  out: ViolationCollector,
  path: string,
  label: string,
  value: number,
  min: number,
  exclusive: boolean,
  max: number,
): void => {
  if (
    !Number.isFinite(value) ||
    (exclusive ? value <= min : value < min) ||
    value > max
  )
    out.push(
      "range",
      path,
      `${label} must be finite within ${exclusive ? "(" : "["}${min}, ${max}]`,
      value,
    );
};

/** A safe integer inside `[min, max]`. */
const integer = (
  out: ViolationCollector,
  path: string,
  label: string,
  value: number,
  min: number,
  max: number,
): void => {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    out.push(
      "type",
      path,
      `${label} must be an integer within [${min}, ${max}]`,
      value,
    );
};

/** A cell-indexed array whose length must equal the lattice's cell count. */
const length = (
  out: ViolationCollector,
  path: string,
  label: string,
  actual: number,
  cells: number,
): void => {
  if (actual !== cells)
    out.push(
      "type",
      path,
      `${label} must hold exactly one value per cell (${cells}), but held ${actual}`,
      actual,
    );
};

/** A declared collection that must stay inside its budget. */
const count = (
  out: ViolationCollector,
  path: string,
  label: string,
  actual: number,
  budget: number,
): void => {
  if (actual > budget)
    out.push(
      "range",
      path,
      `a fluid domain may declare at most ${budget} ${label}, but declared ${actual}`,
      actual,
      actual - budget,
    );
};

/** A non-empty id that has not already been used by a sibling. */
const identity = (
  out: ViolationCollector,
  path: string,
  label: string,
  id: string,
  seen: Set<string>,
): void => {
  if (id.trim().length === 0)
    out.push("type", `${path}.id`, `${label} id must be non-empty`, id);
  else if (seen.has(id))
    out.push("type", `${path}.id`, `${label} id "${id}" is duplicated`, id);
  seen.add(id);
};

/** A cell index pair that lands inside the lattice and not on solid matter. */
const site = (
  out: ViolationCollector,
  path: string,
  domain: IAutoMovieFluidDomain,
  column: number,
  row: number,
): void => {
  integer(
    out,
    `${path}.column`,
    "cell column",
    column,
    0,
    domain.grid.columns - 1,
  );
  integer(out, `${path}.row`, "cell row", row, 0, domain.grid.rows - 1);
  if (
    inside(column, domain.grid.columns) &&
    inside(row, domain.grid.rows) &&
    domain.solid[row * domain.grid.columns + column] === true
  )
    out.push(
      "type",
      path,
      `cell (${column}, ${row}) is solid and cannot host a declared source, drain, or spray`,
      { column, row },
    );
};

/** Whether one lattice index is an in-range cell coordinate. */
const inside = (value: number, limit: number): boolean =>
  Number.isSafeInteger(value) && value >= 0 && value < limit;

/** An activity window whose end, when given, is strictly after its start. */
const window = (
  out: ViolationCollector,
  path: string,
  start: number,
  end: number | null,
): void => {
  numeric(out, `${path}.start`, "activity start", start, 0, false, Infinity);
  if (end === null) return;
  numeric(out, `${path}.end`, "activity end", end, 0, false, Infinity);
  if (Number.isFinite(end) && Number.isFinite(start) && end <= start)
    out.push(
      "range",
      `${path}.end`,
      `activity end must be strictly after its start (${start}), but was ${end}`,
      end,
    );
};
