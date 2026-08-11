import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import type { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";
import type { IAutoMovieCapsuleProxy } from "../validation/IAutoMovieCapsuleProxy";

/**
 * One independent deterministic soft-body computation domain: a curtain, a
 * blind, a rug, a cushion cover, a bed sheet, a hanging membrane.
 *
 * The record is deliberately **not** a member of the architecture package, for
 * the same reason a fluid domain is not. A curtain across an atrium window, a
 * banner in a hall and a sheet over a prop crate are the same computational
 * object as a flag in a production world with no building at all; a building
 * only _binds_ a domain to one of its logical spaces (see
 * {@link IAutoMovieSoftFurnishing}). Making the solver a child of the building
 * would make the same cloth two different things depending on who owns the
 * frame.
 *
 * The state is a **fixed lattice, fixed step** position-based cloth: particles
 * at the lattice sites carry mass and velocity, and distance constraints along
 * the lattice rows, columns, diagonals and second neighbours resist stretching,
 * shearing and folding. That is a bounded first tier on purpose. It is not a
 * finite-element continuum shell, it does not resolve cloth-on-cloth contact
 * (see {@link selfCollision}), it has no friction or air-drag anisotropy, and it
 * does not promise byte-identical results from a GPU projection: the CPU
 * reference state defined here is the only normative one.
 *
 * Particle-indexed arrays are **row-major**: index `row * lattice.columns +
 * column`, with `column` increasing along the panel's first authored axis and
 * `row` along its second. Nothing here fixes those axes to world `x` and `z`: a
 * rug lies flat and a curtain hangs vertically, and both are stated by the
 * world-space {@link rest} positions rather than by an orientation field that
 * two authors could disagree about.
 *
 * The authored configuration is **cloth at rest**: every distance constraint
 * takes its rest length from {@link rest} itself, so an undisturbed panel with
 * no gravity, no wind and unmoved anchors produces numerically exact zero
 * corrections and never drifts, however many steps are integrated.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `IAutoMovieSoftBodyDomain` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `IAutoMovieSoftBodyDomain` for the soft collider and solver transition system contract.
 */
export interface IAutoMovieSoftBodyDomain {
  /**
   * Schema version.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `version` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `version` for the soft collider and solver transition system contract.
   */
  version: 1;

  /**
   * Stable identity of this soft-body domain.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `id` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `id` for the soft collider and solver transition system contract.
   */
  id: string;

  /**
   * All authored lengths are measured in metres.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `units` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `units` for the soft collider and solver transition system contract.
   */
  units: "meter";

  /**
   * Fixed particle lattice.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `lattice` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `lattice` for the soft collider and solver transition system contract.
   */
  lattice: IAutoMovieSoftLattice;

  /**
   * Fixed-step integration settings and declared budgets.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `solver` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `solver` for the soft collider and solver transition system contract.
   */
  solver: IAutoMovieSoftSolver;

  /**
   * World-space rest position of every particle, `[x, y, z, ...]`, row-major.
   * Length must be exactly `3 * lattice.columns * lattice.rows`.
   *
   * This is the panel's authored shape and, simultaneously, the definition of
   * every constraint's rest length. A pre-folded curtain, a draped runner and a
   * flat sheet are all stated here; the solver never invents a rest shape.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `rest` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `rest` for the soft collider and solver transition system contract.
   */
  rest: number[];

  /**
   * Mass of every particle in kilograms, row-major, each strictly positive.
   * Length must be exactly `lattice.columns * lattice.rows`. A heavier hem
   * makes a curtain hang straighter, which is the physical way to author weight
   * rather than a decorative one.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `mass` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `mass` for the soft collider and solver transition system contract.
   */
  mass: number[];

  /**
   * Where the panel is fixed: a curtain's rings on its track, a rug's tacked
   * corner, the seam a cushion cover is sewn along.
   *
   * An anchored particle is a hard boundary condition: it holds its target
   * position exactly and carries zero velocity, so no constraint and no
   * collider can drag it away.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `anchors` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `anchors` for the soft collider and solver transition system contract.
   */
  anchors: IAutoMovieSoftAnchor[];

  /**
   * Named configurations of the anchors: `open` and `closed` for a curtain,
   * `spread` and `folded` for a throw.
   *
   * A named state is a boundary condition, not a keyframe. It moves the
   * declared anchors and lets the solver find the folds; nothing here dictates
   * where a crease lands, which is exactly why two states of the same panel
   * cannot contradict each other's physics.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `states` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `states` for the soft collider and solver transition system contract.
   */
  states: IAutoMovieSoftNamedState[];

  /**
   * What the panel may not pass through: the floor, a rail, a sofa arm.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `colliders` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `colliders` for the soft collider and solver transition system contract.
   */
  colliders: IAutoMovieSoftCollider[];

  /**
   * A deterministic draught, or `null` for still air.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `wind` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `wind` for the soft collider and solver transition system contract.
   */
  wind: IAutoMovieSoftWind | null;

  /**
   * Whether the author is asking for cloth-on-cloth contact.
   *
   * This tier does not provide it. Declaring it is legitimate — it states what
   * the panel actually needs — and the engine answers with an `unsupported`
   * capability status rather than quietly solving a panel that passes through
   * itself and presenting the result as a simulation.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `selfCollision` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `selfCollision` for the soft collider and solver transition system contract.
   */
  selfCollision: boolean;
}

/**
 * The fixed particle lattice a soft-body domain is solved on.
 *
 * Either axis may be a single particle — a cord is a lattice one wide — but
 * their product must be at least two, because a single particle carries no
 * constraint at all and there would be nothing for the solver to hold
 * together.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `IAutoMovieSoftLattice` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `IAutoMovieSoftLattice` for the soft collider and solver transition system contract.
 */
export interface IAutoMovieSoftLattice {
  /**
   * Particle count along the panel's first axis; at least 1.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `columns` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `columns` for the soft collider and solver transition system contract.
   */
  columns: number;

  /**
   * Particle count along the panel's second axis; at least 1.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `rows` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `rows` for the soft collider and solver transition system contract.
   */
  rows: number;
}

/**
 * Fixed-step integration settings and the budgets validation enforces.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `IAutoMovieSoftSolver` as the portable data boundary for the effects soft solver state requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `IAutoMovieSoftSolver` for the soft collider and solver transition system contract.
 */
export interface IAutoMovieSoftSolver {
  /**
   * Integration step in seconds; strictly positive.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `fixedStepSeconds` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `fixedStepSeconds` for the soft collider and solver transition system contract.
   */
  fixedStepSeconds: number;

  /**
   * Uniform body acceleration in m/s², normally `{ x: 0, y: -9.81, z: 0 }`. A
   * vector rather than a magnitude so a panel can be solved in a tilted frame
   * without rewriting its rest mesh.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `gravity` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `gravity` for the soft collider and solver transition system contract.
   */
  gravity: IAutoMovieVector3;

  /**
   * Linear velocity damping in 1/s, applied implicitly as `v / (1 + dt·drag)`,
   * which is how cloth loses energy to the air around it. `0` is undamped.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `drag` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `drag` for the soft collider and solver transition system contract.
   */
  drag: number;

  /**
   * Constraint relaxation sweeps per step; an integer of at least 1. More
   * sweeps make the panel less stretchy at a linear cost, which is the honest
   * trade a position-based solver offers instead of a spring constant.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `iterations` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `iterations` for the soft collider and solver transition system contract.
   */
  iterations: number;

  /**
   * How hard each constraint family pulls, each in `[0, 1]`.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `stiffness` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `stiffness` for the soft collider and solver transition system contract.
   */
  stiffness: IAutoMovieSoftStiffness;

  /**
   * The fastest particle motion this panel is designed for, in m/s, strictly
   * positive. It is the speed the travel condition is checked against: a step
   * that could displace a particle further than the shortest constraint would
   * tunnel through a collider and project a constraint the wrong way.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `referenceSpeed` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `referenceSpeed` for the soft collider and solver transition system contract.
   */
  referenceSpeed: number;

  /**
   * Highest absolute step index a sample may integrate to. It bounds the work
   * one seek can cost, so a shot cannot silently ask for an unbounded solve.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Exposes `maxSteps` as the portable data boundary for the effects soft solver state requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `maxSteps` for the soft collider and solver transition system contract.
   */
  maxSteps: number;
}

/**
 * How hard each constraint family pulls, each in `[0, 1]`.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IAutoMovieSoftStiffness` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMovieSoftStiffness` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMovieSoftStiffness {
  /**
   * Row and column neighbours: resists stretching.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `structural` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `structural` for the interior space soft furnishing planting system contract.
   */
  structural: number;

  /**
   * Diagonal neighbours: resists shearing, which is what makes cloth drape.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `shear` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `shear` for the interior space soft furnishing planting system contract.
   */
  shear: number;

  /**
   * Second neighbours along a row or column: resists folding too sharply.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `bend` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `bend` for the interior space soft furnishing planting system contract.
   */
  bend: number;
}

/**
 * One particle held at a stated place.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IAutoMovieSoftAnchor` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMovieSoftAnchor` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMovieSoftAnchor {
  /**
   * Stable anchor identity within the domain.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `id` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
   */
  id: string;

  /**
   * Row-major particle index; `0 <= particle < columns * rows`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `particle` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `particle` for the interior space soft furnishing planting system contract.
   */
  particle: number;

  /**
   * Where the anchor holds that particle in world space, or `null` to hold it
   * exactly at its own rest position. `null` is the honest default: a seam that
   * never moves should not have to restate a coordinate the rest mesh already
   * carries, where a typo would silently pre-stretch the panel.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `position` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `position` for the interior space soft furnishing planting system contract.
   */
  position: IAutoMovieVector3 | null;

  /**
   * Optional moving owner whose local point replaces the static position at
   * each fixed-step boundary. When present, validation requires `position` to
   * be null; the engine never silently combines the two frames.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Distinguishes world anchors from object and actor-bone anchors.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Reads one immutable evaluated owner pose before the soft solve.
   */
  binding?: IAutoMovieSoftAnchorBinding;
}

/**
 * Moving subject-local point that drives one soft anchor.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Makes object and actor-bone ownership explicit.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Resolves the local point once at the fixed-step boundary.
 */
export type IAutoMovieSoftAnchorBinding =
  | {
      /** Bind to a production scene node. */
      kind: "node";
      /** Stable scene-node identity. */
      node: string;
      /** Node-local anchor offset in meters. */
      offset: IAutoMovieVector3;
    }
  | {
      /** Bind to a humanoid bone on an actor. */
      kind: "actor-bone";
      /** Stable actor participant identity. */
      actor: string;
      /** Humanoid bone that owns the local point. */
      bone: AutoMovieHumanoidBone;
      /** Bone-local anchor offset in meters. */
      offset: IAutoMovieVector3;
    };

/**
 * One named configuration of a panel's anchors.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Exposes `IAutoMovieSoftNamedState` as the portable data boundary for the effects soft anchors requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Types `IAutoMovieSoftNamedState` for the soft static moving anchor input system contract.
 */
export interface IAutoMovieSoftNamedState {
  /**
   * Stable state identity within the domain, such as `open` or `closed`.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Exposes `id` as the portable data boundary for the effects soft anchors requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Types `id` for the soft static moving anchor input system contract.
   */
  id: string;

  /**
   * Anchors this state moves. Anchors absent from the list keep their declared
   * position, so `open` states only the rings that actually gather.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Exposes `anchors` as the portable data boundary for the effects soft anchors requirement.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Types `anchors` for the soft static moving anchor input system contract.
   */
  anchors: IAutoMovieSoftAnchorPose[];
}

/**
 * Where one named state holds one anchor.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IAutoMovieSoftAnchorPose` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMovieSoftAnchorPose` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMovieSoftAnchorPose {
  /**
   * Id of an anchor declared by the same domain.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `anchor` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `anchor` for the interior space soft furnishing planting system contract.
   */
  anchor: string;

  /**
   * World position that anchor holds in this state.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `position` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `position` for the interior space soft furnishing planting system contract.
   */
  position: IAutoMovieVector3;
}

/**
 * One volume the panel is kept out of.
 *
 * Colliders are stated in world space beside the rest mesh rather than pulled
 * from the building graph, so the same rug drapes over the same step whether or
 * not a building owns the frame. A binding may of course place both.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Exposes `IAutoMovieSoftCollider` as the portable data boundary for the effects soft colliders requirement.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Types `IAutoMovieSoftCollider` for the soft collider and solver transition system contract.
 */
export type IAutoMovieSoftCollider =
  | IAutoMovieSoftCollider.IPlane
  | IAutoMovieSoftCollider.ISphere
  | IAutoMovieSoftCollider.IBox
  | IAutoMovieSoftCollider.IBodyCapsule;
export namespace IAutoMovieSoftCollider {
  /**
   * A half-space: the floor, a wall, a table top extended to infinity.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IPlane` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IPlane` for the interior space soft furnishing planting system contract.
   */
  export interface IPlane {
    /**
     * Discriminator.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `kind` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `kind` for the interior space soft furnishing planting system contract.
     */
    kind: "plane";
    /**
     * Stable collider identity within the domain.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `id` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
     */
    id: string;
    /**
     * Outward normal of the allowed side; non-zero and need not be unit.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `normal` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `normal` for the interior space soft furnishing planting system contract.
     */
    normal: IAutoMovieVector3;
    /**
     * Particles are kept where `dot(normalize(normal), p) >= offset`.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `offset` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `offset` for the interior space soft furnishing planting system contract.
     */
    offset: number;
  }

  /**
   * A ball: a cushion's stuffing, a finial, a bolster.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `ISphere` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `ISphere` for the interior space soft furnishing planting system contract.
   */
  export interface ISphere {
    /**
     * Discriminator.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `kind` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `kind` for the interior space soft furnishing planting system contract.
     */
    kind: "sphere";
    /**
     * Stable collider identity within the domain.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `id` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
     */
    id: string;
    /**
     * World centre.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `center` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `center` for the interior space soft furnishing planting system contract.
     */
    center: IAutoMovieVector3;
    /**
     * Strictly positive radius in metres.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `radius` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `radius` for the interior space soft furnishing planting system contract.
     */
    radius: number;
  }

  /**
   * An axis-aligned world box: a sill, a shelf, a sofa arm, a crate.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IBox` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IBox` for the interior space soft furnishing planting system contract.
   */
  export interface IBox {
    /**
     * Discriminator.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `kind` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `kind` for the interior space soft furnishing planting system contract.
     */
    kind: "box";
    /**
     * Stable collider identity within the domain.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `id` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
     */
    id: string;
    /**
     * Minimum corner.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `min` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `min` for the interior space soft furnishing planting system contract.
     */
    min: IAutoMovieVector3;
    /**
     * Maximum corner, strictly greater on every axis.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `max` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `max` for the interior space soft furnishing planting system contract.
     */
    max: IAutoMovieVector3;
  }

  /**
   * Shared capsule following one actor's evaluated humanoid pose.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Reuses the body capsule representation for soft contact.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Resolves moving capsule geometry before ordered collision projection.
   * @author Samchon
   */
  export interface IBodyCapsule {
    /**
     * Body-following capsule discriminator.
     *
     * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Distinguishes a moving body proxy from static world primitives.
     * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Selects evaluated-pose capsule resolution.
     */
    kind: "body-capsule";
    /**
     * Stable collider identity within the domain.
     *
     * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Gives the shared collider a traceable identity.
     * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Preserves deterministic collider ordering.
     */
    id: string;
    /**
     * Stable actor participant whose pose places the capsule.
     *
     * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Refuses a missing body target instead of inventing an origin collider.
     * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Joins the shared proxy to one evaluated actor pose.
     */
    actor: string;
    /**
     * Actor-local capsule shared with body validation and contact systems.
     *
     * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Uses one representation across body and soft collision.
     * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Supplies the bounded segment and radius for projection.
     */
    capsule: IAutoMovieCapsuleProxy;
  }
}

/**
 * A deterministic draught pushing on the panel.
 *
 * The gust is a **triangular** wave rather than a sinusoid on purpose. Only `+
 * − × ÷`, `Math.abs`, `Math.floor` and `Math.sqrt` are exactly specified by
 * IEEE-754 and ECMAScript alike; `Math.sin` is implementation-approximated, and
 * a curtain whose folds depend on which engine built the frame is not a
 * deterministic curtain.
 *
 * The draught is uniform over the panel and does not resolve the local surface
 * normal, so it billows a hanging curtain rather than modelling lift. That is
 * the bounded first tier, stated here instead of implied by a coefficient.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IAutoMovieSoftWind` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMovieSoftWind` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMovieSoftWind {
  /**
   * Direction the draught pushes; non-zero and need not be unit.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `direction` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `direction` for the interior space soft furnishing planting system contract.
   */
  direction: IAutoMovieVector3;

  /**
   * Steady component of the draught's acceleration in m/s²; may be negative.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `acceleration` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `acceleration` for the interior space soft furnishing planting system contract.
   */
  acceleration: number;

  /**
   * Amplitude of the triangular gust in m/s²; `>= 0`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `gustAcceleration` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `gustAcceleration` for the interior space soft furnishing planting system contract.
   */
  gustAcceleration: number;

  /**
   * Gust frequency in Hz; `>= 0`, where `0` holds the gust at its peak.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `gustHz` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `gustHz` for the interior space soft furnishing planting system contract.
   */
  gustHz: number;
}
