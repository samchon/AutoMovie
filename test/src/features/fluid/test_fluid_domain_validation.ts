import {
  FLUID_MAX_CELLS,
  FLUID_MAX_FLOWS,
  FLUID_MAX_SPRAYS,
  FLUID_MAX_SPRAY_PARTICLES,
  FLUID_MAX_STEPS,
  validateFluidDomain,
} from "@automovie/engine";
import {
  IAutoMovieFluidDomain,
  IAutoMovieFluidDrain,
  IAutoMovieFluidSource,
  IAutoMovieFluidSpray,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { flatBasin } from "../internal/fluidFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

const basin = (overrides: Partial<IAutoMovieFluidDomain> = {}) =>
  flatBasin({ columns: 4, rows: 4, depth: 0.25, overrides });

const source = (
  overrides: Partial<IAutoMovieFluidSource> = {},
): IAutoMovieFluidSource => ({
  id: "jet",
  column: 1,
  row: 1,
  flowRate: 0.05,
  start: 0,
  end: null,
  ...overrides,
});

const drain = (
  overrides: Partial<IAutoMovieFluidDrain> = {},
): IAutoMovieFluidDrain => ({
  id: "return",
  column: 2,
  row: 2,
  flowRate: 0.05,
  sillLevel: 0,
  start: 0,
  end: null,
  ...overrides,
});

const spray = (
  overrides: Partial<IAutoMovieFluidSpray> = {},
): IAutoMovieFluidSpray => ({
  id: "mist",
  column: 1,
  row: 1,
  rate: 8,
  lifetime: 1,
  speed: 2,
  direction: { x: 0, y: 1, z: 0 },
  spread: 0.25,
  size: 0.05,
  seed: 7,
  maxParticles: 64,
  lodDistance: 12,
  ...overrides,
});

/**
 * Every budget, range, relation and stability condition a fluid domain declares
 * is enforced, and each is pinned against an adjacent domain one property away
 * where it must not fire.
 *
 * A validator that only ever says no is indistinguishable from a validator that
 * always says no, so the clean domain below is as load-bearing as any refusal:
 * it is what proves the twenty refusals are about the property named rather
 * than about the fixture.
 *
 * Scenarios:
 *
 * 1. A well-formed basin with a source, a drain and a spray validates clean.
 * 2. Identity and schema: an empty id, a wrong schema version, and non-metre units
 *    are each refused.
 * 3. The lattice: a fractional column count, a zero row count, a non-positive cell
 *    size, a non-finite origin, and a lattice past the cell budget.
 * 4. The solver: a non-positive step, gravity, and reference depth; a negative
 *    drag and dry depth; a step budget past `FLUID_MAX_STEPS`.
 * 5. Stability: a Courant number above one is refused with the overshoot, while a
 *    domain exactly on the limit is accepted; a non-finite Courant number is
 *    reported through its own fields rather than as a stability failure.
 * 6. State arrays: wrong lengths, a negative depth, a depth past the declared
 *    reference depth, a non-finite bed, and water sitting in solid matter.
 * 7. Boundaries: an unknown edge kind on each of the four edges.
 * 8. Declared flows: empty and duplicate ids, counts past the budget, cells off
 *    the lattice in all three ways an index can be wrong, cells inside solid
 *    matter, and activity windows that are non-finite or end before they
 *    start.
 * 9. Spray: non-positive rate, lifetime, size and LOD distance; a negative speed;
 *    spread outside `[0, 1]`; a particle cap outside its budget; an unsafe
 *    seed; and a direction that is non-finite or zero.
 */
export const test_fluid_domain_validation = (): void => {
  const clean = validateFluidDomain({
    domain: basin({
      sources: [source()],
      drains: [drain()],
      sprays: [spray()],
    }),
  });
  TestValidator.equals(
    "a well-formed basin validates clean",
    clean.success,
    true,
  );

  const schema = validateFluidDomain({
    domain: basin({
      id: "  ",
      version: 2 as unknown as 1,
      units: "feet" as unknown as "meter",
    }),
  });
  TestValidator.equals(
    "identity and schema are refused when wrong",
    namedFacts([
      ["id", () => hasViolation(schema, "type", "$input.id")],
      ["version", () => hasViolation(schema, "type", "$input.version")],
      ["units", () => hasViolation(schema, "type", "$input.units")],
    ]),
    { id: true, version: true, units: true },
  );

  const lattice = validateFluidDomain({
    domain: basin({
      grid: {
        columns: 2.5,
        rows: 0,
        cellX: 0,
        cellZ: -1,
        origin: { x: 0, y: Number.NaN, z: 0 },
      },
    }),
  });
  const huge = validateFluidDomain({
    domain: basin({
      grid: {
        columns: 300,
        rows: 300,
        cellX: 1,
        cellZ: 1,
        origin: { x: 0, y: 0, z: 0 },
      },
      bed: new Array(90_000).fill(0),
      depth: new Array(90_000).fill(0),
      solid: new Array(90_000).fill(false),
    }),
  });
  TestValidator.equals(
    "the lattice must be a whole, positive, affordable grid",
    namedFacts([
      ["columns", () => hasViolation(lattice, "type", "$input.grid.columns")],
      ["rows", () => hasViolation(lattice, "type", "$input.grid.rows")],
      ["cellX", () => hasViolation(lattice, "range", "$input.grid.cellX")],
      ["cellZ", () => hasViolation(lattice, "range", "$input.grid.cellZ")],
      ["origin", () => hasViolation(lattice, "range", "$input.grid.origin.y")],
      ["budget", () => hasViolation(huge, "range", "$input.grid")],
      ["budgetValue", () => FLUID_MAX_CELLS === 65_536],
    ]),
    {
      columns: true,
      rows: true,
      cellX: true,
      cellZ: true,
      origin: true,
      budget: true,
      budgetValue: true,
    },
  );

  const solver = validateFluidDomain({
    domain: basin({
      solver: {
        fixedStepSeconds: 0,
        gravity: 0,
        drag: -1,
        dryDepth: -0.5,
        referenceDepth: 0,
        maxSteps: FLUID_MAX_STEPS + 1,
      },
    }),
  });
  TestValidator.equals(
    "the solver settings must be physically usable",
    namedFacts([
      [
        "step",
        () => hasViolation(solver, "range", "$input.solver.fixedStepSeconds"),
      ],
      ["gravity", () => hasViolation(solver, "range", "$input.solver.gravity")],
      ["drag", () => hasViolation(solver, "range", "$input.solver.drag")],
      ["dry", () => hasViolation(solver, "range", "$input.solver.dryDepth")],
      [
        "reference",
        () => hasViolation(solver, "range", "$input.solver.referenceDepth"),
      ],
      ["steps", () => hasViolation(solver, "type", "$input.solver.maxSteps")],
    ]),
    {
      step: true,
      gravity: true,
      drag: true,
      dry: true,
      reference: true,
      steps: true,
    },
  );

  // dt·sqrt(g·H)·sqrt(1/dx² + 1/dz²) with g = 8, H = 2, dx = dz = 1 is
  // dt·4·sqrt(2), so dt = 1/(4·sqrt(2)) sits exactly on the stability limit.
  const onLimit = 1 / (4 * Math.SQRT2);
  const stable = validateFluidDomain({
    domain: basin({
      grid: {
        columns: 4,
        rows: 4,
        cellX: 1,
        cellZ: 1,
        origin: { x: 0, y: 0, z: 0 },
      },
      solver: {
        fixedStepSeconds: onLimit,
        gravity: 8,
        drag: 0,
        dryDepth: 0,
        referenceDepth: 2,
        maxSteps: 100,
      },
    }),
  });
  const unstable = validateFluidDomain({
    domain: basin({
      grid: {
        columns: 4,
        rows: 4,
        cellX: 1,
        cellZ: 1,
        origin: { x: 0, y: 0, z: 0 },
      },
      solver: {
        fixedStepSeconds: onLimit * 2,
        gravity: 8,
        drag: 0,
        dryDepth: 0,
        referenceDepth: 2,
        maxSteps: 100,
      },
    }),
  });
  const nonFiniteCourant = validateFluidDomain({
    domain: basin({
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: Number.NaN,
        drag: 0,
        dryDepth: 0,
        referenceDepth: 2,
        maxSteps: 100,
      },
    }),
  });
  TestValidator.equals(
    "the Courant condition is the stability gate, and it has both sides",
    namedFacts([
      ["stable", () => stable.success === true],
      [
        "unstable",
        () => hasViolation(unstable, "range", "$input.solver.fixedStepSeconds"),
      ],
      [
        "nonFinite",
        () =>
          hasViolation(nonFiniteCourant, "range", "$input.solver.gravity") &&
          hasViolation(
            nonFiniteCourant,
            "range",
            "$input.solver.fixedStepSeconds",
          ) === false,
      ],
    ]),
    { stable: true, unstable: true, nonFinite: true },
  );

  const solid = new Array(16).fill(false);
  solid[5] = true;
  const arrays = validateFluidDomain({
    domain: basin({
      bed: [Number.NaN, 0, 0],
      depth: [-0.1, 99, 0.25, 0.25],
      solid,
    }),
  });
  const wetPier = validateFluidDomain({
    domain: basin({ solid, depth: new Array(16).fill(0.25) }),
  });
  TestValidator.equals(
    "the state arrays must be one finite, non-negative value per cell",
    namedFacts([
      ["bedLength", () => hasViolation(arrays, "type", "$input.bed")],
      ["bedFinite", () => hasViolation(arrays, "range", "$input.bed[0]")],
      ["depthLength", () => hasViolation(arrays, "type", "$input.depth")],
      ["depthNegative", () => hasViolation(arrays, "range", "$input.depth[0]")],
      ["depthTooDeep", () => hasViolation(arrays, "range", "$input.depth[1]")],
      ["wetPier", () => hasViolation(wetPier, "type", "$input.depth[5]")],
      [
        "solidLength",
        () =>
          hasViolation(
            validateFluidDomain({ domain: basin({ solid: [false] }) }),
            "type",
            "$input.solid",
          ),
      ],
    ]),
    {
      bedLength: true,
      bedFinite: true,
      depthLength: true,
      depthNegative: true,
      depthTooDeep: true,
      wetPier: true,
      solidLength: true,
    },
  );

  const edges = validateFluidDomain({
    domain: basin({
      boundaries: {
        xMin: "leak" as unknown as "wall",
        xMax: "leak" as unknown as "wall",
        zMin: "leak" as unknown as "wall",
        zMax: "leak" as unknown as "wall",
      },
    }),
  });
  TestValidator.equals(
    "an unknown edge kind is refused on every edge",
    namedFacts([
      ["xMin", () => hasViolation(edges, "type", "$input.boundaries.xMin")],
      ["xMax", () => hasViolation(edges, "type", "$input.boundaries.xMax")],
      ["zMin", () => hasViolation(edges, "type", "$input.boundaries.zMin")],
      ["zMax", () => hasViolation(edges, "type", "$input.boundaries.zMax")],
    ]),
    { xMin: true, xMax: true, zMin: true, zMax: true },
  );

  const flows = validateFluidDomain({
    domain: basin({
      solid,
      sources: [
        source({ id: " " }),
        source({ id: "jet" }),
        source({ id: "jet" }),
        source({ id: "off-lattice", column: 1.5, row: 1 }),
        source({ id: "negative", column: -1, row: 1 }),
        source({ id: "past-edge", column: 99, row: 1 }),
        source({ id: "row-past-edge", column: 1, row: 99 }),
        source({ id: "on-pier", column: 1, row: 1 }),
        source({ id: "backwards", flowRate: -1 }),
      ],
      drains: [
        drain({ id: "sill", sillLevel: Number.NaN }),
        drain({ id: "reverse", flowRate: -2 }),
        drain({ id: "backwards-window", start: 5, end: 1 }),
        drain({ id: "unstarted", start: -1 }),
        drain({ id: "non-finite-end", end: Number.POSITIVE_INFINITY }),
      ],
    }),
  });
  const tooMany = validateFluidDomain({
    domain: basin({
      sources: Array.from({ length: FLUID_MAX_FLOWS + 1 }, (_, at) =>
        source({ id: `jet-${at}` }),
      ),
      drains: Array.from({ length: FLUID_MAX_FLOWS + 1 }, (_, at) =>
        drain({ id: `drain-${at}` }),
      ),
      sprays: Array.from({ length: FLUID_MAX_SPRAYS + 1 }, (_, at) =>
        spray({ id: `mist-${at}` }),
      ),
    }),
  });
  TestValidator.equals(
    "a declared flow must name itself, land on water, and open sanely",
    namedFacts([
      ["emptyId", () => hasViolation(flows, "type", "$input.sources[0].id")],
      [
        "duplicateId",
        () => hasViolation(flows, "type", "$input.sources[2].id"),
      ],
      [
        "fractionalColumn",
        () => hasViolation(flows, "type", "$input.sources[3].column"),
      ],
      [
        "negativeColumn",
        () => hasViolation(flows, "type", "$input.sources[4].column"),
      ],
      [
        "columnPastEdge",
        () => hasViolation(flows, "type", "$input.sources[5].column"),
      ],
      [
        "rowPastEdge",
        () => hasViolation(flows, "type", "$input.sources[6].row"),
      ],
      ["onPier", () => hasViolation(flows, "type", "$input.sources[7]")],
      [
        "negativeRate",
        () => hasViolation(flows, "range", "$input.sources[8].flowRate"),
      ],
      [
        "sill",
        () => hasViolation(flows, "range", "$input.drains[0].sillLevel"),
      ],
      [
        "drainRate",
        () => hasViolation(flows, "range", "$input.drains[1].flowRate"),
      ],
      [
        "backwardsWindow",
        () => hasViolation(flows, "range", "$input.drains[2].end"),
      ],
      [
        "negativeStart",
        () => hasViolation(flows, "range", "$input.drains[3].start"),
      ],
      [
        "nonFiniteEnd",
        () => hasViolation(flows, "range", "$input.drains[4].end"),
      ],
      ["sourceBudget", () => hasViolation(tooMany, "range", "$input.sources")],
      ["drainBudget", () => hasViolation(tooMany, "range", "$input.drains")],
      ["sprayBudget", () => hasViolation(tooMany, "range", "$input.sprays")],
    ]),
    {
      emptyId: true,
      duplicateId: true,
      fractionalColumn: true,
      negativeColumn: true,
      columnPastEdge: true,
      rowPastEdge: true,
      onPier: true,
      negativeRate: true,
      sill: true,
      drainRate: true,
      backwardsWindow: true,
      negativeStart: true,
      nonFiniteEnd: true,
      sourceBudget: true,
      drainBudget: true,
      sprayBudget: true,
    },
  );

  const mists = validateFluidDomain({
    domain: basin({
      sprays: [
        spray({
          id: "broken",
          rate: 0,
          lifetime: 0,
          speed: -1,
          spread: 2,
          size: 0,
          lodDistance: 0,
          maxParticles: FLUID_MAX_SPRAY_PARTICLES + 1,
          seed: 1.5,
          direction: { x: 0, y: 0, z: 0 },
        }),
        spray({ id: "under", spread: -0.5, maxParticles: 0 }),
        spray({ id: "nan-axis", direction: { x: Number.NaN, y: 1, z: 0 } }),
        spray({ id: "nan-y", direction: { x: 0, y: Number.NaN, z: 0 } }),
        spray({ id: "nan-z", direction: { x: 0, y: 1, z: Number.NaN } }),
      ],
    }),
  });
  TestValidator.equals(
    "a spray emitter must describe a bounded, launchable jet",
    namedFacts([
      ["rate", () => hasViolation(mists, "range", "$input.sprays[0].rate")],
      [
        "lifetime",
        () => hasViolation(mists, "range", "$input.sprays[0].lifetime"),
      ],
      ["speed", () => hasViolation(mists, "range", "$input.sprays[0].speed")],
      [
        "spreadOver",
        () => hasViolation(mists, "range", "$input.sprays[0].spread"),
      ],
      ["size", () => hasViolation(mists, "range", "$input.sprays[0].size")],
      [
        "lod",
        () => hasViolation(mists, "range", "$input.sprays[0].lodDistance"),
      ],
      [
        "capOver",
        () => hasViolation(mists, "type", "$input.sprays[0].maxParticles"),
      ],
      ["seed", () => hasViolation(mists, "type", "$input.sprays[0].seed")],
      [
        "zeroAxis",
        () => hasViolation(mists, "type", "$input.sprays[0].direction"),
      ],
      [
        "spreadUnder",
        () => hasViolation(mists, "range", "$input.sprays[1].spread"),
      ],
      [
        "capUnder",
        () => hasViolation(mists, "type", "$input.sprays[1].maxParticles"),
      ],
      ["nanX", () => hasViolation(mists, "type", "$input.sprays[2].direction")],
      ["nanY", () => hasViolation(mists, "type", "$input.sprays[3].direction")],
      ["nanZ", () => hasViolation(mists, "type", "$input.sprays[4].direction")],
    ]),
    {
      rate: true,
      lifetime: true,
      speed: true,
      spreadOver: true,
      size: true,
      lod: true,
      capOver: true,
      seed: true,
      zeroAxis: true,
      spreadUnder: true,
      capUnder: true,
      nanX: true,
      nanY: true,
      nanZ: true,
    },
  );
};
