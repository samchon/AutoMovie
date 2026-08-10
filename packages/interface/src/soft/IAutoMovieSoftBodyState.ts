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
 */
export interface IAutoMovieSoftBodyState {
  /** Identity of the domain this state belongs to. */
  domain: string;

  /** Named state whose anchor poses were applied, or `null` for the default. */
  state: string | null;

  /** Absolute integer step index, `0` being the authored rest configuration. */
  step: number;

  /** Absolute domain-clock second, exactly `step * solver.fixedStepSeconds`. */
  time: number;

  /** World particle positions `[x, y, z, ...]` in metres, row-major. */
  positions: number[];

  /** World particle velocities `[x, y, z, ...]` in m/s, row-major. */
  velocities: number[];

  /**
   * Fastest particle speed in this state, in m/s.
   *
   * Measured evidence against {@link IAutoMovieSoftSolver.referenceSpeed}: the
   * declared budget is what the travel condition was checked against, and this
   * is what actually happened, so a reviewer can see whether the declaration
   * held instead of taking it on trust.
   */
  maxSpeed: number;

  /**
   * Largest relative stretch of any structural constraint, `|d − L| / L`.
   *
   * `0` is inextensible. It is the honest measure of what the declared
   * stiffness and iteration count bought, since a position-based solver
   * approaches inextensibility rather than enforcing it.
   */
  maxStrain: number;

  /**
   * Particle-collider resolutions applied during the last integrated step.
   *
   * `0` at step `0`, where nothing has been integrated yet — which is not the
   * same claim as a panel resting clear of everything around it. A rest
   * configuration touching a floor still reports no contact, because no step
   * has asked it to.
   */
  contacts: number;
}

/**
 * The derived drawable geometry of one soft-body state.
 *
 * The engine owns this derivation so the renderer stays a projection: the mesh
 * a viewer uploads and the particle field the solver produced are one
 * statement, not two that can disagree.
 */
export interface IAutoMovieSoftBodySurface {
  /** Identity of the domain the surface was derived from. */
  domain: string;

  /** Absolute step the surface was derived at. */
  step: number;

  /**
   * Triangulated panel. One vertex per particle in row-major order, so a vertex
   * index and a particle index are the same number, and two triangles per
   * lattice quad. Normals are area-weighted from the incident triangles and UVs
   * are the normalized lattice coordinates, so a fabric pattern does not swim
   * as the panel folds.
   */
  mesh: IAutoMovieMesh;

  /**
   * World extent of the panel, or `null` when no triangle was emitted at all —
   * a lattice too thin to hold one quad.
   *
   * One nullable box rather than a nullable minimum beside a nullable maximum:
   * the two can only ever be absent together, and a pair that must agree is a
   * pair that can be made to disagree.
   */
  bounds: IAutoMovieSoftBounds | null;
}

/** A world-space axis-aligned box. */
export interface IAutoMovieSoftBounds {
  /** Minimum corner. */
  min: IAutoMovieVector3;

  /** Maximum corner. */
  max: IAutoMovieVector3;
}

/**
 * The bounded cost a soft-body domain adds to a shot, for the compiler report.
 *
 * Every field is derived from the domain record alone, so a production can be
 * refused for an unaffordable panel before a single step is integrated.
 */
export interface IAutoMovieSoftBodyBudget {
  /** Identity of the measured domain. */
  domain: string;

  /** Lattice particles, `columns * rows`. */
  particles: number;

  /** Row and column distance constraints. */
  structural: number;

  /** Diagonal distance constraints. */
  shear: number;

  /** Second-neighbour distance constraints. */
  bend: number;

  /** Declared colliders. */
  colliders: number;

  /** Bytes one state occupies as 64-bit reals: `8 * 6 * particles`. */
  stateBytes: number;

  /** Highest absolute step a sample may integrate to. */
  maxSteps: number;

  /** Constraint gathers a worst-case seek costs. */
  worstCaseGathers: number;

  /**
   * Travel number `dt · referenceSpeed / shortestRestLength`. At most `1`, or a
   * particle can cross a constraint or a collider inside one step.
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
 */
export interface IAutoMovieSoftAnalysis {
  /** Identity of the analysed domain. */
  domain: string;

  /** Which analysis was asked for. */
  kind: AutoMovieSoftAnalysisKind;

  /** What the analysis was able to produce. */
  status: AutoMovieSoftAnalysisStatus;

  /** Why, in one sentence, when the status is not a plain success. */
  reason: string | null;

  /** Capabilities the record asked for that this tier does not provide. */
  unsupported: string[];
}

/** The analyses this domain family provides. */
export type AutoMovieSoftAnalysisKind = "soft-body" | "planting";

/**
 * - `solved`: the fixed-step solve ran and the state is its result.
 * - `rest`: the authored rest configuration was requested and returned as such.
 * - `derived`: a deterministic derivation ran; nothing was integrated over time.
 * - `not-run`: the record did not validate, so nothing was computed at all.
 * - `unsupported`: a declared capability this tier does not provide was asked
 *   for, so no solved state is claimed.
 */
export type AutoMovieSoftAnalysisStatus =
  | "solved"
  | "rest"
  | "derived"
  | "not-run"
  | "unsupported";
