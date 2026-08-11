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
 *
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `IAutoMovieFluidState` as the portable data boundary for the effects fluid seek state requirement.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `IAutoMovieFluidState` for the fluid seek and checkpoint state system contract.
 */
export interface IAutoMovieFluidState {
  /**
   * Identity of the domain this state belongs to.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `domain` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `domain` for the fluid seek and checkpoint state system contract.
   */
  domain: string;

  /**
   * Absolute integer step index, `0` being the authored initial state.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `step` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `step` for the fluid seek and checkpoint state system contract.
   */
  step: number;

  /**
   * Absolute domain-clock second, exactly `step * solver.fixedStepSeconds`.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `time` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `time` for the fluid seek and checkpoint state system contract.
   */
  time: number;

  /**
   * Water depth per cell in metres, row-major, never negative.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `depth` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `depth` for the fluid seek and checkpoint state system contract.
   */
  depth: number[];

  /**
   * Face velocity along `+x` in m/s, indexed `row * (columns + 1) + column`
   * with `column` in `[0, columns]`. Face `column` separates cell `column - 1`
   * from cell `column`; the outermost two lie on the domain edge.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `velocityX` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `velocityX` for the fluid seek and checkpoint state system contract.
   */
  velocityX: number[];

  /**
   * Face velocity along `+z` in m/s, indexed `row * columns + column` with
   * `row` in `[0, rows]`. Face `row` separates cell row `row - 1` from cell row
   * `row`; the outermost two lie on the domain edge.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `velocityZ` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `velocityZ` for the fluid seek and checkpoint state system contract.
   */
  velocityZ: number[];

  /**
   * Water volume currently held by the lattice, in m³.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `volume` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `volume` for the fluid seek and checkpoint state system contract.
   */
  volume: number;

  /**
   * Cumulative volume admitted by declared sources since step 0, in m³.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `sourceVolume` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `sourceVolume` for the fluid seek and checkpoint state system contract.
   */
  sourceVolume: number;

  /**
   * Cumulative volume removed by declared drains since step 0, in m³.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `drainVolume` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `drainVolume` for the fluid seek and checkpoint state system contract.
   */
  drainVolume: number;

  /**
   * Cumulative volume that left across `open` edges since step 0, in m³.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Exposes `outflowVolume` as the portable data boundary for the effects fluid seek state requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Types `outflowVolume` for the fluid seek and checkpoint state system contract.
   */
  outflowVolume: number;
}

/**
 * The derived free-surface geometry of one fluid state.
 *
 * The engine owns this derivation so the renderer stays a projection: the mesh
 * a viewer uploads and the depth field the solver produced are one statement,
 * not two that can disagree.
 *
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Exposes `IAutoMovieFluidSurface` as the portable data boundary for the effects fluid surface flow tier requirement.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Types `IAutoMovieFluidSurface` for the fluid surface and flow tier system contract.
 */
export interface IAutoMovieFluidSurface {
  /**
   * Identity of the domain the surface was derived from.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Exposes `domain` as the portable data boundary for the effects fluid surface flow tier requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Types `domain` for the fluid surface and flow tier system contract.
   */
  domain: string;

  /**
   * Absolute step the surface was derived at.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Exposes `step` as the portable data boundary for the effects fluid surface flow tier requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Types `step` for the fluid surface and flow tier system contract.
   */
  step: number;

  /**
   * Triangulated free surface in world space. Vertices sit at cell centres, one
   * per cell including dry ones, so vertex order is the row-major cell order;
   * only quads whose four corner cells are wet and non-solid are triangulated,
   * which is what makes a dry basin draw nothing.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Exposes `mesh` as the portable data boundary for the effects fluid surface flow tier requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Types `mesh` for the fluid surface and flow tier system contract.
   */
  mesh: IAutoMovieMesh;

  /**
   * World extent of the drawn surface, or `null` when no quad was emitted at
   * all — a drained basin, or a lattice too small to hold one.
   *
   * One nullable box rather than a nullable minimum beside a nullable maximum:
   * the two can only ever be absent together, and a pair that must agree is a
   * pair that can be made to disagree.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Exposes `bounds` as the portable data boundary for the effects fluid surface flow tier requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Types `bounds` for the fluid surface and flow tier system contract.
   */
  bounds: IAutoMovieFluidSurfaceBounds | null;

  /**
   * Per-vertex horizontal flow velocity `[x, z, ...]` in m/s, aligned to the
   * mesh vertices: the cell-centred average of the four surrounding faces. A
   * renderer scrolls ripples along it; it never re-derives it.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Exposes `flow` as the portable data boundary for the effects fluid surface flow tier requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Types `flow` for the fluid surface and flow tier system contract.
   */
  flow: number[];
}

/**
 * The world-space box a drawn fluid surface occupies.
 *
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Exposes `IAutoMovieFluidSurfaceBounds` as the portable data boundary for the effects fluid surface flow tier requirement.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Types `IAutoMovieFluidSurfaceBounds` for the fluid surface and flow tier system contract.
 */
export interface IAutoMovieFluidSurfaceBounds {
  /**
   * Minimum corner.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Exposes `min` as the portable data boundary for the effects fluid surface flow tier requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Types `min` for the fluid surface and flow tier system contract.
   */
  min: IAutoMovieVector3;

  /**
   * Maximum corner.
   *
   * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-surface-flow-tier Exposes `max` as the portable data boundary for the effects fluid surface flow tier requirement.
   * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Types `max` for the fluid surface and flow tier system contract.
   */
  max: IAutoMovieVector3;
}

/**
 * One live decorative spray particle.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `IAutoMovieFluidSprayParticle` as the portable data boundary for the interior fluid flow spray requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidSprayParticle` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidSprayParticle {
  /**
   * Emitter that spawned it.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `spray` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `spray` for the interior space water feature fluid domain system contract.
   */
  spray: string;

  /**
   * Stable zero-based spawn identity within that emitter.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `index` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `index` for the interior space water feature fluid domain system contract.
   */
  index: number;

  /**
   * World position at the sampled step.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `position` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `position` for the interior space water feature fluid domain system contract.
   */
  position: IAutoMovieVector3;

  /**
   * World billboard size in metres.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `size` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `size` for the interior space water feature fluid domain system contract.
   */
  size: number;

  /**
   * Normalized lifetime progress in `[0, 1)`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `ageRatio` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `ageRatio` for the interior space water feature fluid domain system contract.
   */
  ageRatio: number;
}

/**
 * One bounded decorative spray sample at an absolute step.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `IAutoMovieFluidSpraySample` as the portable data boundary for the interior fluid flow spray requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidSpraySample` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidSpraySample {
  /**
   * Absolute integer step index sampled.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `step` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `step` for the interior space water feature fluid domain system contract.
   */
  step: number;

  /**
   * Absolute domain-clock second sampled.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `time` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `time` for the interior space water feature fluid domain system contract.
   */
  time: number;

  /**
   * Live particles after distance thinning and the hard per-emitter cap.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-flow-spray Exposes `particles` as the portable data boundary for the interior fluid flow spray requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `particles` for the interior space water feature fluid domain system contract.
   */
  particles: IAutoMovieFluidSprayParticle[];
}

/**
 * The bounded cost a fluid domain adds to a shot, for the compiler report.
 *
 * Every field is derived from the domain record alone, so a production can be
 * refused for an unaffordable water feature before a single step is
 * integrated.
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `IAutoMovieFluidBudget` as the portable data boundary for the interior fluid initial boundary record requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieFluidBudget` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieFluidBudget {
  /**
   * Identity of the measured domain.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `domain` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `domain` for the interior space water feature fluid domain system contract.
   */
  domain: string;

  /**
   * Lattice cells, `columns * rows`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `cells` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `cells` for the interior space water feature fluid domain system contract.
   */
  cells: number;

  /**
   * Velocity faces, `(columns + 1) * rows + columns * (rows + 1)`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `faces` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `faces` for the interior space water feature fluid domain system contract.
   */
  faces: number;

  /**
   * Bytes one state occupies as 64-bit reals: `8 * (cells + faces)`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `stateBytes` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `stateBytes` for the interior space water feature fluid domain system contract.
   */
  stateBytes: number;

  /**
   * Highest absolute step a sample may integrate to.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `maxSteps` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `maxSteps` for the interior space water feature fluid domain system contract.
   */
  maxSteps: number;

  /**
   * Cell updates a worst-case seek costs, `cells * maxSteps`.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `worstCaseCellUpdates` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `worstCaseCellUpdates` for the interior space water feature fluid domain system contract.
   */
  worstCaseCellUpdates: number;

  /**
   * Sum of every emitter's hard particle cap.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `sprayParticleCap` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `sprayParticleCap` for the interior space water feature fluid domain system contract.
   */
  sprayParticleCap: number;

  /**
   * Courant number `dt * sqrt(g * referenceDepth) * sqrt(1/dx² + 1/dz²)`. At
   * most `1` for a stable explicit solve.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `courant` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `courant` for the interior space water feature fluid domain system contract.
   */
  courant: number;
}
