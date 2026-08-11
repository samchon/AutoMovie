import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieMesh } from "../model/IAutoMovieMesh";

/**
 * The complete state of a soft-body domain at one **absolute** step.
 *
 * Absolute is the whole contract. A state is a pure function of the domain
 * record, the named state applied and the integer step index, so seeking a shot
 * backwards, forwards, or out of order yields exactly the same numbers as
 * playing it straight through; nothing accumulates in a runtime object between
 * frames.
 *
 * Particle arrays are flat and row-major: particle `k = row * columns + column`
 * occupies `[3k, 3k + 1, 3k + 2]`.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `IAutoMovieSoftBodyState` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `IAutoMovieSoftBodyState` for the soft collider and solver transition system contract.
 */
export interface IAutoMovieSoftBodyState {
  /**
   * Identity of the domain this state belongs to.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `domain` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `domain` for the soft collider and solver transition system contract.
   */
  domain: string;

  /**
   * Named state whose anchor poses were applied, or `null` for the default.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `state` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `state` for the soft collider and solver transition system contract.
   */
  state: string | null;

  /**
   * Absolute integer step index, `0` being the authored rest configuration.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `step` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `step` for the soft collider and solver transition system contract.
   */
  step: number;

  /**
   * Absolute domain-clock second, exactly `step * solver.fixedStepSeconds`.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `time` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `time` for the soft collider and solver transition system contract.
   */
  time: number;

  /**
   * World particle positions `[x, y, z, ...]` in metres, row-major.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `positions` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `positions` for the soft collider and solver transition system contract.
   */
  positions: number[];

  /**
   * World particle velocities `[x, y, z, ...]` in m/s, row-major.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `velocities` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `velocities` for the soft collider and solver transition system contract.
   */
  velocities: number[];

  /**
   * Fastest particle speed in this state, in m/s.
   *
   * Measured evidence against {@link IAutoMovieSoftSolver.referenceSpeed}: the
   * declared budget is what the travel condition was checked against, and this
   * is what actually happened, so a reviewer can see whether the declaration
   * held instead of taking it on trust.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `maxSpeed` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `maxSpeed` for the soft collider and solver transition system contract.
   */
  maxSpeed: number;

  /**
   * Largest relative stretch of any structural constraint, `|d − L| / L`.
   *
   * `0` is inextensible. It is the honest measure of what the declared
   * stiffness and iteration count bought, since a position-based solver
   * approaches inextensibility rather than enforcing it.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `maxStrain` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `maxStrain` for the soft collider and solver transition system contract.
   */
  maxStrain: number;

  /**
   * Particle-collider resolutions applied during the last integrated step.
   *
   * `0` at step `0`, where nothing has been integrated yet — which is not the
   * same claim as a panel resting clear of everything around it. A rest
   * configuration touching a floor still reports no contact, because no step
   * has asked it to.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `contacts` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `contacts` for the soft collider and solver transition system contract.
   */
  contacts: number;
}

/**
 * The derived drawable geometry of one soft-body state.
 *
 * The engine owns this derivation so the renderer stays a projection: the mesh
 * a viewer uploads and the particle field the solver produced are one
 * statement, not two that can disagree.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `IAutoMovieSoftBodySurface` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `IAutoMovieSoftBodySurface` for the soft collider and solver transition system contract.
 */
export interface IAutoMovieSoftBodySurface {
  /**
   * Identity of the domain the surface was derived from.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `domain` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `domain` for the soft collider and solver transition system contract.
   */
  domain: string;

  /**
   * Absolute step the surface was derived at.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `step` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `step` for the soft collider and solver transition system contract.
   */
  step: number;

  /**
   * Triangulated panel. One vertex per particle in row-major order, so a vertex
   * index and a particle index are the same number, and two triangles per
   * lattice quad. Normals are area-weighted from the incident triangles and UVs
   * are the normalized lattice coordinates, so a fabric pattern does not swim
   * as the panel folds.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `mesh` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `mesh` for the soft collider and solver transition system contract.
   */
  mesh: IAutoMovieMesh;

  /**
   * World extent of the panel, or `null` when no triangle was emitted at all —
   * a lattice too thin to hold one quad.
   *
   * One nullable box rather than a nullable minimum beside a nullable maximum:
   * the two can only ever be absent together, and a pair that must agree is a
   * pair that can be made to disagree.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `bounds` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `bounds` for the soft collider and solver transition system contract.
   */
  bounds: IAutoMovieSoftBounds | null;
}

/**
 * A world-space axis-aligned box.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `IAutoMovieSoftBounds` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `IAutoMovieSoftBounds` for the soft collider and solver transition system contract.
 */
export interface IAutoMovieSoftBounds {
  /**
   * Minimum corner.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `min` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `min` for the soft collider and solver transition system contract.
   */
  min: IAutoMovieVector3;

  /**
   * Maximum corner.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `max` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `max` for the soft collider and solver transition system contract.
   */
  max: IAutoMovieVector3;
}

/**
 * The bounded cost a soft-body domain adds to a shot, for the compiler report.
 *
 * Every field is derived from the domain record alone, so a production can be
 * refused for an unaffordable panel before a single step is integrated.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `IAutoMovieSoftBodyBudget` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `IAutoMovieSoftBodyBudget` for the soft collider and solver transition system contract.
 */
export interface IAutoMovieSoftBodyBudget {
  /**
   * Identity of the measured domain.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `domain` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `domain` for the soft collider and solver transition system contract.
   */
  domain: string;

  /**
   * Lattice particles, `columns * rows`.
   *
   * The derived surface carries one vertex per particle, so this is also the
   * drawn vertex count a render budget attributes device memory to.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `particles` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `particles` for the soft collider and solver transition system contract.
   */
  particles: number;

  /**
   * Triangles the derived surface draws: two per lattice quad.
   *
   * It happens to equal {@link shear}, because a quad carries two diagonals and
   * two triangles alike. They are separate statements about separate costs —
   * one is what the solver projects, the other is what the GPU rasterizes — and
   * a consumer reading the constraint count as a triangle count would be right
   * by coincidence and wrong the moment either side changes.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `triangles` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `triangles` for the soft collider and solver transition system contract.
   */
  triangles: number;

  /**
   * Row and column distance constraints.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `structural` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `structural` for the soft collider and solver transition system contract.
   */
  structural: number;

  /**
   * Diagonal distance constraints.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `shear` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `shear` for the soft collider and solver transition system contract.
   */
  shear: number;

  /**
   * Second-neighbour distance constraints.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `bend` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `bend` for the soft collider and solver transition system contract.
   */
  bend: number;

  /**
   * Declared colliders.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `colliders` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `colliders` for the soft collider and solver transition system contract.
   */
  colliders: number;

  /**
   * Bytes one state occupies as 64-bit reals: `8 * 6 * particles`.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `stateBytes` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `stateBytes` for the soft collider and solver transition system contract.
   */
  stateBytes: number;

  /**
   * Highest absolute step a sample may integrate to.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `maxSteps` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `maxSteps` for the soft collider and solver transition system contract.
   */
  maxSteps: number;

  /**
   * Constraint gathers a worst-case seek costs.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `worstCaseGathers` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `worstCaseGathers` for the soft collider and solver transition system contract.
   */
  worstCaseGathers: number;

  /**
   * Travel number `dt · referenceSpeed / shortestRestLength`. At most `1`, or a
   * particle can cross a constraint or a collider inside one step.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `travel` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `travel` for the soft collider and solver transition system contract.
   */
  travel: number;
}

/**
 * What a domain's analysis actually did, and what it declined to claim.
 *
 * An unsupported or unexecuted analysis is reported here, never dressed as a
 * success: a panel drawn in its rest shape because the solver could not honour
 * what it was asked for is a _reported_ rest shape, not a simulation that
 * happened to look still.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `IAutoMovieSoftAnalysis` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `IAutoMovieSoftAnalysis` for the soft collider and solver transition system contract.
 */
export interface IAutoMovieSoftAnalysis {
  /**
   * Identity of the analysed domain.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `domain` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `domain` for the soft collider and solver transition system contract.
   */
  domain: string;

  /**
   * Which analysis was asked for.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `kind` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `kind` for the soft collider and solver transition system contract.
   */
  kind: AutoMovieSoftAnalysisKind;

  /**
   * What the analysis was able to produce.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `status` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `status` for the soft collider and solver transition system contract.
   */
  status: AutoMovieSoftAnalysisStatus;

  /**
   * Why, in one sentence, when the status is not a plain success.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `reason` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `reason` for the soft collider and solver transition system contract.
   */
  reason: string | null;

  /**
   * Capabilities the record asked for that this tier does not provide.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `unsupported` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `unsupported` for the soft collider and solver transition system contract.
   */
  unsupported: string[];
}

/**
 * The analyses this domain family provides.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `AutoMovieSoftAnalysisKind` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `AutoMovieSoftAnalysisKind` for the soft collider and solver transition system contract.
 */
export type AutoMovieSoftAnalysisKind = "soft-body" | "planting";

/**
 * - `solved`: the fixed-step solve ran and the state is its result.
 * - `rest`: the authored rest configuration was requested and returned as such.
 * - `derived`: a deterministic derivation ran; nothing was integrated over time.
 * - `not-run`: nothing was computed at all, because the record did not validate
 *   or the request fell outside what the record declared.
 * - `unsupported`: a declared capability this tier does not provide was asked
 *   for, so no solved state is claimed.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `AutoMovieSoftAnalysisStatus` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `AutoMovieSoftAnalysisStatus` for the soft collider and solver transition system contract.
 */
export type AutoMovieSoftAnalysisStatus =
  | "solved"
  | "rest"
  | "derived"
  | "not-run"
  | "unsupported";
