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
 */
export interface IAutoMovieFluidDomain {
  /** Schema version. */
  version: 1;

  /** Stable identity of this fluid domain. */
  id: string;

  /** All authored lengths are measured in metres. */
  units: "meter";

  /** Fixed computational lattice. */
  grid: IAutoMovieFluidGrid;

  /** Fixed-step integration settings and declared budgets. */
  solver: IAutoMovieFluidSolver;

  /** Which side of the lattice reflects and which lets water leave. */
  boundaries: IAutoMovieFluidBoundaries;

  /**
   * Bed elevation of every cell in metres **above `grid.origin.y`**, row-major.
   * Length must be exactly `grid.columns * grid.rows`. The world elevation of
   * dry ground in a cell is therefore `grid.origin.y + bed[k]`.
   */
  bed: number[];

  /**
   * Initial water depth of every cell in metres, row-major, each `>= 0`. The
   * world elevation of the free surface is `grid.origin.y + bed[k] +
   * depth[k]`.
   */
  depth: number[];

  /**
   * Cells occupied by solid matter (a pier, an island, a channel wall). A solid
   * cell holds no water and every face touching it reflects. Length must be
   * exactly `grid.columns * grid.rows`, row-major.
   */
  solid: boolean[];

  /** Declared inflows. Water they add is counted, never invented silently. */
  sources: IAutoMovieFluidSource[];

  /** Declared outflows such as a fountain return or a basin overflow. */
  drains: IAutoMovieFluidDrain[];

  /**
   * Decorative bounded spray emitters. Spray is **not** part of the conserved
   * water: it is a bounded particle garnish sampled from the same clock, and
   * its mass never enters or leaves the depth field.
   */
  sprays: IAutoMovieFluidSpray[];
}

/** The fixed lattice a fluid domain is solved on. */
export interface IAutoMovieFluidGrid {
  /** Cell count along `+x`; at least 1. */
  columns: number;

  /** Cell count along `+z`; at least 1. */
  rows: number;

  /** Cell size along `+x` in metres; strictly positive. */
  cellX: number;

  /** Cell size along `+z` in metres; strictly positive. */
  cellZ: number;

  /**
   * World position of the lattice corner at `column = 0, row = 0`. `x`/`z` are
   * the minimum corner of that cell; `y` is the datum every `bed` value is
   * measured above.
   */
  origin: IAutoMovieVector3;
}

/** Fixed-step integration settings and the budgets validation enforces. */
export interface IAutoMovieFluidSolver {
  /** Integration step in seconds; strictly positive. */
  fixedStepSeconds: number;

  /** Gravity magnitude in m/s²; strictly positive (Earth is `9.81`). */
  gravity: number;

  /**
   * Linear drag in 1/s applied implicitly to face velocity, which is how a
   * shallow basin loses momentum to its floor. `0` is frictionless.
   */
  drag: number;

  /**
   * Depth in metres at or below which a cell counts as dry, so no water is
   * pushed uphill onto land it cannot reach. `0` still refuses flow out of an
   * empty cell; a small positive value also suppresses film-thin sloshing.
   */
  dryDepth: number;

  /**
   * The deepest water this domain is designed for, in metres, strictly
   * positive. It is the depth the Courant condition is checked against, and no
   * initial depth may exceed it.
   */
  referenceDepth: number;

  /**
   * Highest absolute step index a sample may integrate to. It bounds the work
   * one seek can cost, so a shot cannot silently ask for an unbounded solve.
   */
  maxSteps: number;
}

/** Which lattice edge reflects and which lets water leave the domain. */
export interface IAutoMovieFluidBoundaries {
  /** Edge at `column = 0`. */
  xMin: AutoMovieFluidBoundaryKind;

  /** Edge past `column = columns - 1`. */
  xMax: AutoMovieFluidBoundaryKind;

  /** Edge at `row = 0`. */
  zMin: AutoMovieFluidBoundaryKind;

  /** Edge past `row = rows - 1`. */
  zMax: AutoMovieFluidBoundaryKind;
}

/**
 * `wall` reflects: no water crosses and the face velocity is pinned to zero.
 * `open` behaves exactly like a permanently dry neighbouring cell at the same
 * bed height, so water spills off the rim and the volume that left is counted.
 */
export type AutoMovieFluidBoundaryKind = "wall" | "open";

/** One declared inflow into a single cell. */
export interface IAutoMovieFluidSource {
  /** Stable source identity within the domain. */
  id: string;

  /** Cell column receiving the water; `0 <= column < grid.columns`. */
  column: number;

  /** Cell row receiving the water; `0 <= row < grid.rows`. */
  row: number;

  /** Volumetric inflow in m³/s; must be `>= 0`. Use a drain to remove water. */
  flowRate: number;

  /** Domain-clock second at which the source starts; finite and `>= 0`. */
  start: number;

  /** Domain-clock second at which it stops, or `null` for "never". */
  end: number | null;
}

/** One declared outflow from a single cell. */
export interface IAutoMovieFluidDrain {
  /** Stable drain identity within the domain. */
  id: string;

  /** Cell column the water leaves from; `0 <= column < grid.columns`. */
  column: number;

  /** Cell row the water leaves from; `0 <= row < grid.rows`. */
  row: number;

  /**
   * Maximum volumetric outflow in m³/s; must be `>= 0`. The realized rate is
   * limited by the water actually available in the cell during the step.
   */
  flowRate: number;

  /**
   * Free-surface elevation in metres above `grid.origin.y` below which the
   * drain is closed: the sill of an overflow weir, or the bed elevation for a
   * plain floor drain.
   */
  sillLevel: number;

  /** Domain-clock second at which the drain opens; finite and `>= 0`. */
  start: number;

  /** Domain-clock second at which it closes, or `null` for "never". */
  end: number | null;
}

/**
 * One bounded decorative spray emitter: the mist of a fountain jet or the
 * curtain at the foot of a water wall.
 *
 * Spray is deterministic from `seed` and the particle index alone, so seeking
 * to a time reproduces the same particles regardless of what was sampled
 * before, and it is bounded twice: by `maxParticles` and by distance thinning.
 */
export interface IAutoMovieFluidSpray {
  /** Stable emitter identity within the domain. */
  id: string;

  /** Cell column the emitter sits in; `0 <= column < grid.columns`. */
  column: number;

  /** Cell row the emitter sits in; `0 <= row < grid.rows`. */
  row: number;

  /** Particles spawned per second; strictly positive. */
  rate: number;

  /** Particle lifetime in seconds; strictly positive. */
  lifetime: number;

  /** Launch speed in m/s along {@link direction}; `>= 0`. */
  speed: number;

  /** Launch direction; must not be the zero vector and need not be unit. */
  direction: IAutoMovieVector3;

  /**
   * Symmetric per-axis jitter added to the normalized launch direction, in the
   * closed range `[0, 1]`. `0` emits a perfectly collimated jet.
   */
  spread: number;

  /** World billboard size of one particle in metres; strictly positive. */
  size: number;

  /** Deterministic seed; any safe integer. */
  seed: number;

  /** Hard cap on simultaneously live particles; a positive integer. */
  maxParticles: number;

  /**
   * Camera distance in metres past which the live set is deterministically
   * thinned; strictly positive.
   */
  lodDistance: number;
}
