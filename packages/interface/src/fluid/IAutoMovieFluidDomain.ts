import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * One independent deterministic fluid computation domain.
 *
 * The record is deliberately **not** a member of the architecture package. A
 * pond in an atrium, a circulating channel around a courtyard, a fountain basin
 * and a falling water wall are all the same computational object as a tank in a
 * production world with no building at all; the building only _binds_ a domain
 * to one of its logical spaces (see `IAutoMovieWaterFeature`). Making the
 * solver a child of the building would make the same water two different things
 * depending on who owns the frame.
 *
 * The state is a **fixed grid, fixed step** shallow-water field: a per-cell
 * water depth over a per-cell bed elevation plus horizontal face velocities.
 * That is a bounded first tier on purpose. It is not an arbitrary 3D
 * Navier-Stokes solver, it does not resolve breaking waves, vertical
 * recirculation, or surface tension, and it does not promise byte-identical
 * results from a GPU projection: the CPU reference state defined here is the
 * only normative one.
 *
 * All cell-indexed arrays are **row-major**: index `row * grid.columns +
 * column`, with `column` increasing along `+x` and `row` along `+z`.
 *
 * The authored state is **water at rest**: a domain states depths over a bed,
 * and every face velocity starts at zero. Motion comes from what the water
 * cannot be in equilibrium with — an uneven free surface, a declared source or
 * drain, an open rim — so an initial velocity field is not a thing an author
 * has to invent, and two authors cannot state the same current twice.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `IAutoMovieFluidDomain` as the portable data boundary for the interior fluid initial boundary record requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidDomain` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidDomain {
  /**
   * Schema version.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `version` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `version` for the interior space water feature fluid domain system contract.
   */
  version: 1;

  /**
   * Stable identity of this fluid domain.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `id` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `id` for the interior space water feature fluid domain system contract.
   */
  id: string;

  /**
   * All authored lengths are measured in metres.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `units` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `units` for the interior space water feature fluid domain system contract.
   */
  units: "meter";

  /**
   * Fixed computational lattice.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `grid` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `grid` for the interior space water feature fluid domain system contract.
   */
  grid: IAutoMovieFluidGrid;

  /**
   * Fixed-step integration settings and declared budgets.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `solver` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `solver` for the interior space water feature fluid domain system contract.
   */
  solver: IAutoMovieFluidSolver;

  /**
   * Which side of the lattice reflects and which lets water leave.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `boundaries` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `boundaries` for the interior space water feature fluid domain system contract.
   */
  boundaries: IAutoMovieFluidBoundaries;

  /**
   * Bed elevation of every cell in metres **above `grid.origin.y`**, row-major.
   * Length must be exactly `grid.columns * grid.rows`. The world elevation of
   * dry ground in a cell is therefore `grid.origin.y + bed[k]`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `bed` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `bed` for the interior space water feature fluid domain system contract.
   */
  bed: number[];

  /**
   * Initial water depth of every cell in metres, row-major, each `>= 0`. The
   * world elevation of the free surface is `grid.origin.y + bed[k] +
   * depth[k]`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `depth` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `depth` for the interior space water feature fluid domain system contract.
   */
  depth: number[];

  /**
   * Cells occupied by solid matter (a pier, an island, a channel wall). A solid
   * cell holds no water and every face touching it reflects. Length must be
   * exactly `grid.columns * grid.rows`, row-major.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `solid` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `solid` for the interior space water feature fluid domain system contract.
   */
  solid: boolean[];

  /**
   * Declared inflows. Water they add is counted, never invented silently.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `sources` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `sources` for the interior space water feature fluid domain system contract.
   */
  sources: IAutoMovieFluidSource[];

  /**
   * Declared outflows such as a fountain return or a basin overflow.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `drains` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `drains` for the interior space water feature fluid domain system contract.
   */
  drains: IAutoMovieFluidDrain[];

  /**
   * Decorative bounded spray emitters. Spray is **not** part of the conserved
   * water: it is a bounded particle garnish sampled from the same clock, and
   * its mass never enters or leaves the depth field.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `sprays` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `sprays` for the interior space water feature fluid domain system contract.
   */
  sprays: IAutoMovieFluidSpray[];
}

/**
 * The fixed lattice a fluid domain is solved on.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `IAutoMovieFluidGrid` as the portable data boundary for the interior fluid volume level requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidGrid` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidGrid {
  /**
   * Cell count along `+x`; at least 1.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `columns` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `columns` for the interior space water feature fluid domain system contract.
   */
  columns: number;

  /**
   * Cell count along `+z`; at least 1.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `rows` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `rows` for the interior space water feature fluid domain system contract.
   */
  rows: number;

  /**
   * Cell size along `+x` in metres; strictly positive.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `cellX` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `cellX` for the interior space water feature fluid domain system contract.
   */
  cellX: number;

  /**
   * Cell size along `+z` in metres; strictly positive.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `cellZ` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `cellZ` for the interior space water feature fluid domain system contract.
   */
  cellZ: number;

  /**
   * World position of the lattice corner at `column = 0, row = 0`. `x`/`z` are
   * the minimum corner of that cell; `y` is the datum every `bed` value is
   * measured above.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `origin` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `origin` for the interior space water feature fluid domain system contract.
   */
  origin: IAutoMovieVector3;
}

/**
 * Fixed-step integration settings and the budgets validation enforces.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `IAutoMovieFluidSolver` as the portable data boundary for the interior fluid volume level requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidSolver` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidSolver {
  /**
   * Integration step in seconds; strictly positive.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `fixedStepSeconds` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `fixedStepSeconds` for the interior space water feature fluid domain system contract.
   */
  fixedStepSeconds: number;

  /**
   * Gravity magnitude in m/s²; strictly positive (Earth is `9.81`).
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `gravity` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `gravity` for the interior space water feature fluid domain system contract.
   */
  gravity: number;

  /**
   * Linear drag in 1/s applied implicitly to face velocity, which is how a
   * shallow basin loses momentum to its floor. `0` is frictionless.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `drag` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `drag` for the interior space water feature fluid domain system contract.
   */
  drag: number;

  /**
   * Depth in metres at or below which a cell counts as dry, so no water is
   * pushed uphill onto land it cannot reach. `0` still refuses flow out of an
   * empty cell; a small positive value also suppresses film-thin sloshing.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `dryDepth` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `dryDepth` for the interior space water feature fluid domain system contract.
   */
  dryDepth: number;

  /**
   * The deepest water this domain is designed for, in metres, strictly
   * positive. It is the depth the Courant condition is checked against, and no
   * initial depth may exceed it.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `referenceDepth` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `referenceDepth` for the interior space water feature fluid domain system contract.
   */
  referenceDepth: number;

  /**
   * Highest absolute step index a sample may integrate to. It bounds the work
   * one seek can cost, so a shot cannot silently ask for an unbounded solve.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `maxSteps` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `maxSteps` for the interior space water feature fluid domain system contract.
   */
  maxSteps: number;
}

/**
 * Which lattice edge reflects and which lets water leave the domain.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `IAutoMovieFluidBoundaries` as the portable data boundary for the interior fluid volume level requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidBoundaries` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidBoundaries {
  /**
   * Edge at `column = 0`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `xMin` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `xMin` for the interior space water feature fluid domain system contract.
   */
  xMin: AutoMovieFluidBoundaryKind;

  /**
   * Edge past `column = columns - 1`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `xMax` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `xMax` for the interior space water feature fluid domain system contract.
   */
  xMax: AutoMovieFluidBoundaryKind;

  /**
   * Edge at `row = 0`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `zMin` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `zMin` for the interior space water feature fluid domain system contract.
   */
  zMin: AutoMovieFluidBoundaryKind;

  /**
   * Edge past `row = rows - 1`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `zMax` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `zMax` for the interior space water feature fluid domain system contract.
   */
  zMax: AutoMovieFluidBoundaryKind;
}

/**
 * `wall` reflects: no water crosses and the face velocity is pinned to zero.
 * `open` behaves exactly like a permanently dry neighbouring cell at the same
 * bed height, so water spills off the rim and the volume that left is counted.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `AutoMovieFluidBoundaryKind` as the portable data boundary for the interior fluid initial boundary record requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `AutoMovieFluidBoundaryKind` for the interior space water feature fluid domain system contract.
 */
export type AutoMovieFluidBoundaryKind = "wall" | "open";

/**
 * One declared inflow into a single cell.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `IAutoMovieFluidSource` as the portable data boundary for the interior fluid volume level requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidSource` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidSource {
  /**
   * Stable source identity within the domain.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `id` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `id` for the interior space water feature fluid domain system contract.
   */
  id: string;

  /**
   * Cell column receiving the water; `0 <= column < grid.columns`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `column` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `column` for the interior space water feature fluid domain system contract.
   */
  column: number;

  /**
   * Cell row receiving the water; `0 <= row < grid.rows`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `row` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `row` for the interior space water feature fluid domain system contract.
   */
  row: number;

  /**
   * Volumetric inflow in m³/s; must be `>= 0`. Use a drain to remove water.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `flowRate` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `flowRate` for the interior space water feature fluid domain system contract.
   */
  flowRate: number;

  /**
   * Domain-clock second at which the source starts; finite and `>= 0`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `start` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `start` for the interior space water feature fluid domain system contract.
   */
  start: number;

  /**
   * Domain-clock second at which it stops, or `null` for "never".
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `end` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `end` for the interior space water feature fluid domain system contract.
   */
  end: number | null;
}

/**
 * One declared outflow from a single cell.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `IAutoMovieFluidDrain` as the portable data boundary for the interior fluid volume level requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidDrain` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidDrain {
  /**
   * Stable drain identity within the domain.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `id` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `id` for the interior space water feature fluid domain system contract.
   */
  id: string;

  /**
   * Cell column the water leaves from; `0 <= column < grid.columns`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `column` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `column` for the interior space water feature fluid domain system contract.
   */
  column: number;

  /**
   * Cell row the water leaves from; `0 <= row < grid.rows`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `row` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `row` for the interior space water feature fluid domain system contract.
   */
  row: number;

  /**
   * Maximum volumetric outflow in m³/s; must be `>= 0`. The realized rate is
   * limited by the water actually available in the cell during the step.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `flowRate` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `flowRate` for the interior space water feature fluid domain system contract.
   */
  flowRate: number;

  /**
   * Free-surface elevation in metres above `grid.origin.y` below which the
   * drain is closed: the sill of an overflow weir, or the bed elevation for a
   * plain floor drain.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `sillLevel` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `sillLevel` for the interior space water feature fluid domain system contract.
   */
  sillLevel: number;

  /**
   * Domain-clock second at which the drain opens; finite and `>= 0`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `start` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `start` for the interior space water feature fluid domain system contract.
   */
  start: number;

  /**
   * Domain-clock second at which it closes, or `null` for "never".
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level Exposes `end` as the portable data boundary for the interior fluid volume level requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `end` for the interior space water feature fluid domain system contract.
   */
  end: number | null;
}

/**
 * One bounded decorative spray emitter: the mist of a fountain jet or the
 * curtain at the foot of a water wall.
 *
 * Spray is deterministic from `seed` and the particle index alone, so seeking
 * to a time reproduces the same particles regardless of what was sampled
 * before, and it is bounded twice: by `maxParticles` and by distance thinning.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `IAutoMovieFluidSpray` as the portable data boundary for the interior fluid flow spray requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidSpray` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidSpray {
  /**
   * Stable emitter identity within the domain.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `id` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `id` for the interior space water feature fluid domain system contract.
   */
  id: string;

  /**
   * Cell column the emitter sits in; `0 <= column < grid.columns`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `column` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `column` for the interior space water feature fluid domain system contract.
   */
  column: number;

  /**
   * Cell row the emitter sits in; `0 <= row < grid.rows`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `row` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `row` for the interior space water feature fluid domain system contract.
   */
  row: number;

  /**
   * Particles spawned per second; strictly positive.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `rate` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `rate` for the interior space water feature fluid domain system contract.
   */
  rate: number;

  /**
   * Particle lifetime in seconds; strictly positive.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `lifetime` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `lifetime` for the interior space water feature fluid domain system contract.
   */
  lifetime: number;

  /**
   * Launch speed in m/s along {@link direction}; `>= 0`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `speed` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `speed` for the interior space water feature fluid domain system contract.
   */
  speed: number;

  /**
   * Launch direction; must not be the zero vector and need not be unit.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `direction` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `direction` for the interior space water feature fluid domain system contract.
   */
  direction: IAutoMovieVector3;

  /**
   * Symmetric per-axis jitter added to the normalized launch direction, in the
   * closed range `[0, 1]`. `0` emits a perfectly collimated jet.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `spread` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `spread` for the interior space water feature fluid domain system contract.
   */
  spread: number;

  /**
   * World billboard size of one particle in metres; strictly positive.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `size` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `size` for the interior space water feature fluid domain system contract.
   */
  size: number;

  /**
   * Deterministic seed; any safe integer.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `seed` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `seed` for the interior space water feature fluid domain system contract.
   */
  seed: number;

  /**
   * Hard cap on simultaneously live particles; a positive integer.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `maxParticles` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `maxParticles` for the interior space water feature fluid domain system contract.
   */
  maxParticles: number;

  /**
   * Camera distance in metres past which the live set is deterministically
   * thinned; strictly positive.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `lodDistance` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `lodDistance` for the interior space water feature fluid domain system contract.
   */
  lodDistance: number;
}
