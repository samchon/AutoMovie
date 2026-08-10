import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieMesh } from "../model/IAutoMovieMesh";

/**
 * The complete conserved state of a fluid domain at one **absolute** step.
 *
 * Absolute is the whole contract. A state is a pure function of the domain
 * record and the integer step index, so seeking a shot backwards, forwards, or
 * out of order yields exactly the same numbers as playing it straight through;
 * nothing accumulates in a runtime object between frames.
 *
 * Cell arrays are row-major (`row * columns + column`). Face arrays are indexed
 * as documented on each field: a face lies _between_ two cells, so there is one
 * more of them than cells along the axis they cross.
 */
export interface IAutoMovieFluidState {
  /** Identity of the domain this state belongs to. */
  domain: string;

  /** Absolute integer step index, `0` being the authored initial state. */
  step: number;

  /** Absolute domain-clock second, exactly `step * solver.fixedStepSeconds`. */
  time: number;

  /** Water depth per cell in metres, row-major, never negative. */
  depth: number[];

  /**
   * Face velocity along `+x` in m/s, indexed `row * (columns + 1) + column`
   * with `column` in `[0, columns]`. Face `column` separates cell `column - 1`
   * from cell `column`; the outermost two lie on the domain edge.
   */
  velocityX: number[];

  /**
   * Face velocity along `+z` in m/s, indexed `row * columns + column` with
   * `row` in `[0, rows]`. Face `row` separates cell row `row - 1` from cell row
   * `row`; the outermost two lie on the domain edge.
   */
  velocityZ: number[];

  /** Water volume currently held by the lattice, in m³. */
  volume: number;

  /** Cumulative volume admitted by declared sources since step 0, in m³. */
  sourceVolume: number;

  /** Cumulative volume removed by declared drains since step 0, in m³. */
  drainVolume: number;

  /** Cumulative volume that left across `open` edges since step 0, in m³. */
  outflowVolume: number;
}

/**
 * The derived free-surface geometry of one fluid state.
 *
 * The engine owns this derivation so the renderer stays a projection: the mesh
 * a viewer uploads and the depth field the solver produced are one statement,
 * not two that can disagree.
 */
export interface IAutoMovieFluidSurface {
  /** Identity of the domain the surface was derived from. */
  domain: string;

  /** Absolute step the surface was derived at. */
  step: number;

  /**
   * Triangulated free surface in world space. Vertices sit at cell centres, one
   * per cell including dry ones, so vertex order is the row-major cell order;
   * only quads whose four corner cells are wet and non-solid are triangulated,
   * which is what makes a dry basin draw nothing.
   */
  mesh: IAutoMovieMesh;

  /**
   * World extent of the drawn surface, or `null` when no quad was emitted at
   * all — a drained basin, or a lattice too small to hold one.
   *
   * One nullable box rather than a nullable minimum beside a nullable maximum:
   * the two can only ever be absent together, and a pair that must agree is a
   * pair that can be made to disagree.
   */
  bounds: IAutoMovieFluidSurfaceBounds | null;

  /**
   * Per-vertex horizontal flow velocity `[x, z, ...]` in m/s, aligned to the
   * mesh vertices: the cell-centred average of the four surrounding faces. A
   * renderer scrolls ripples along it; it never re-derives it.
   */
  flow: number[];
}

/** The world-space box a drawn fluid surface occupies. */
export interface IAutoMovieFluidSurfaceBounds {
  /** Minimum corner. */
  min: IAutoMovieVector3;

  /** Maximum corner. */
  max: IAutoMovieVector3;
}

/** One live decorative spray particle. */
export interface IAutoMovieFluidSprayParticle {
  /** Emitter that spawned it. */
  spray: string;

  /** Stable zero-based spawn identity within that emitter. */
  index: number;

  /** World position at the sampled step. */
  position: IAutoMovieVector3;

  /** World billboard size in metres. */
  size: number;

  /** Normalized lifetime progress in `[0, 1)`. */
  ageRatio: number;
}

/** One bounded decorative spray sample at an absolute step. */
export interface IAutoMovieFluidSpraySample {
  /** Absolute integer step index sampled. */
  step: number;

  /** Absolute domain-clock second sampled. */
  time: number;

  /** Live particles after distance thinning and the hard per-emitter cap. */
  particles: IAutoMovieFluidSprayParticle[];
}

/**
 * The bounded cost a fluid domain adds to a shot, for the compiler report.
 *
 * Every field is derived from the domain record alone, so a production can be
 * refused for an unaffordable water feature before a single step is
 * integrated.
 */
export interface IAutoMovieFluidBudget {
  /** Identity of the measured domain. */
  domain: string;

  /** Lattice cells, `columns * rows`. */
  cells: number;

  /** Velocity faces, `(columns + 1) * rows + columns * (rows + 1)`. */
  faces: number;

  /** Bytes one state occupies as 64-bit reals: `8 * (cells + faces)`. */
  stateBytes: number;

  /** Highest absolute step a sample may integrate to. */
  maxSteps: number;

  /** Cell updates a worst-case seek costs, `cells * maxSteps`. */
  worstCaseCellUpdates: number;

  /** Sum of every emitter's hard particle cap. */
  sprayParticleCap: number;

  /**
   * Courant number `dt * sqrt(g * referenceDepth) * sqrt(1/dx² + 1/dz²)`. At
   * most `1` for a stable explicit solve.
   */
  courant: number;
}
