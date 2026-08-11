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
 */
export interface IAutoMovieSoftBodyDomain {
  /** Schema version. */
  version: 1;

  /** Stable identity of this soft-body domain. */
  id: string;

  /** All authored lengths are measured in metres. */
  units: "meter";

  /** Fixed particle lattice. */
  lattice: IAutoMovieSoftLattice;

  /** Fixed-step integration settings and declared budgets. */
  solver: IAutoMovieSoftSolver;

  /**
   * World-space rest position of every particle, `[x, y, z, ...]`, row-major.
   * Length must be exactly `3 * lattice.columns * lattice.rows`.
   *
   * This is the panel's authored shape and, simultaneously, the definition of
   * every constraint's rest length. A pre-folded curtain, a draped runner and a
   * flat sheet are all stated here; the solver never invents a rest shape.
   */
  rest: number[];

  /**
   * Mass of every particle in kilograms, row-major, each strictly positive.
   * Length must be exactly `lattice.columns * lattice.rows`. A heavier hem
   * makes a curtain hang straighter, which is the physical way to author weight
   * rather than a decorative one.
   */
  mass: number[];

  /**
   * Where the panel is fixed: a curtain's rings on its track, a rug's tacked
   * corner, the seam a cushion cover is sewn along.
   *
   * An anchored particle is a hard boundary condition: it holds its target
   * position exactly and carries zero velocity, so no constraint and no
   * collider can drag it away.
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
   */
  states: IAutoMovieSoftNamedState[];

  /** What the panel may not pass through: the floor, a rail, a sofa arm. */
  colliders: IAutoMovieSoftCollider[];

  /** A deterministic draught, or `null` for still air. */
  wind: IAutoMovieSoftWind | null;

  /**
   * Whether the author is asking for cloth-on-cloth contact.
   *
   * This tier does not provide it. Declaring it is legitimate — it states what
   * the panel actually needs — and the engine answers with an `unsupported`
   * capability status rather than quietly solving a panel that passes through
   * itself and presenting the result as a simulation.
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
 */
export interface IAutoMovieSoftLattice {
  /** Particle count along the panel's first axis; at least 1. */
  columns: number;

  /** Particle count along the panel's second axis; at least 1. */
  rows: number;
}

/** Fixed-step integration settings and the budgets validation enforces. */
export interface IAutoMovieSoftSolver {
  /** Integration step in seconds; strictly positive. */
  fixedStepSeconds: number;

  /**
   * Uniform body acceleration in m/s², normally `{ x: 0, y: -9.81, z: 0 }`. A
   * vector rather than a magnitude so a panel can be solved in a tilted frame
   * without rewriting its rest mesh.
   */
  gravity: IAutoMovieVector3;

  /**
   * Linear velocity damping in 1/s, applied implicitly as `v / (1 + dt·drag)`,
   * which is how cloth loses energy to the air around it. `0` is undamped.
   */
  drag: number;

  /**
   * Constraint relaxation sweeps per step; an integer of at least 1. More
   * sweeps make the panel less stretchy at a linear cost, which is the honest
   * trade a position-based solver offers instead of a spring constant.
   */
  iterations: number;

  /** How hard each constraint family pulls, each in `[0, 1]`. */
  stiffness: IAutoMovieSoftStiffness;

  /**
   * The fastest particle motion this panel is designed for, in m/s, strictly
   * positive. It is the speed the travel condition is checked against: a step
   * that could displace a particle further than the shortest constraint would
   * tunnel through a collider and project a constraint the wrong way.
   */
  referenceSpeed: number;

  /**
   * Highest absolute step index a sample may integrate to. It bounds the work
   * one seek can cost, so a shot cannot silently ask for an unbounded solve.
   */
  maxSteps: number;
}

/** How hard each constraint family pulls, each in `[0, 1]`. */
export interface IAutoMovieSoftStiffness {
  /** Row and column neighbours: resists stretching. */
  structural: number;

  /** Diagonal neighbours: resists shearing, which is what makes cloth drape. */
  shear: number;

  /** Second neighbours along a row or column: resists folding too sharply. */
  bend: number;
}

/** One particle held at a stated place. */
export interface IAutoMovieSoftAnchor {
  /** Stable anchor identity within the domain. */
  id: string;

  /** Row-major particle index; `0 <= particle < columns * rows`. */
  particle: number;

  /**
   * Where the anchor holds that particle in world space, or `null` to hold it
   * exactly at its own rest position. `null` is the honest default: a seam that
   * never moves should not have to restate a coordinate the rest mesh already
   * carries, where a typo would silently pre-stretch the panel.
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
      /**
       * Bind to a production scene node.
       *
       * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Supports a moving object attachment without converting it to a world anchor.
       * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Names the moving subject whose evaluated pose drives the anchor.
       */
      kind: "node";
      /**
       * Stable scene-node identity.
       *
       * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Keeps a missing target distinguishable from an origin attachment.
       * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Makes target resolution a pre-solve validation step.
       */
      node: string;
      /**
       * Node-local anchor offset in meters.
       *
       * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Declares the attachment point in its owning frame.
       * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Transforms the declared local point through the evaluated node pose.
       */
      offset: IAutoMovieVector3;
    }
  | {
      /**
       * Bind to a humanoid bone on an actor.
       *
       * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Supports an actor-bone anchor as a distinct moving boundary.
       * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Reads the actor pose before secondary motion advances.
       */
      kind: "actor-bone";
      /**
       * Stable actor participant identity.
       *
       * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Keeps a missing actor distinguishable from a world-space fallback.
       * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Makes actor resolution an explicit pre-solve join.
       */
      actor: string;
      /**
       * Humanoid bone that owns the local point.
       *
       * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Declares the skeletal attachment instead of inferring one.
       * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Selects the evaluated bone transform consumed by the anchor.
       */
      bone: AutoMovieHumanoidBone;
      /**
       * Bone-local anchor offset in meters.
       *
       * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Declares the attachment point in the bone frame.
       * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Transforms the declared local point through the evaluated bone pose.
       */
      offset: IAutoMovieVector3;
    };

/** One named configuration of a panel's anchors. */
export interface IAutoMovieSoftNamedState {
  /** Stable state identity within the domain, such as `open` or `closed`. */
  id: string;

  /**
   * Anchors this state moves. Anchors absent from the list keep their declared
   * position, so `open` states only the rings that actually gather.
   */
  anchors: IAutoMovieSoftAnchorPose[];
}

/** Where one named state holds one anchor. */
export interface IAutoMovieSoftAnchorPose {
  /** Id of an anchor declared by the same domain. */
  anchor: string;

  /** World position that anchor holds in this state. */
  position: IAutoMovieVector3;
}

/**
 * One volume the panel is kept out of.
 *
 * Colliders are stated in world space beside the rest mesh rather than pulled
 * from the building graph, so the same rug drapes over the same step whether or
 * not a building owns the frame. A binding may of course place both.
 */
export type IAutoMovieSoftCollider =
  | IAutoMovieSoftCollider.IPlane
  | IAutoMovieSoftCollider.ISphere
  | IAutoMovieSoftCollider.IBox
  | IAutoMovieSoftCollider.IBodyCapsule;
export namespace IAutoMovieSoftCollider {
  /** A half-space: the floor, a wall, a table top extended to infinity. */
  export interface IPlane {
    /** Discriminator. */
    kind: "plane";
    /** Stable collider identity within the domain. */
    id: string;
    /** Outward normal of the allowed side; non-zero and need not be unit. */
    normal: IAutoMovieVector3;
    /** Particles are kept where `dot(normalize(normal), p) >= offset`. */
    offset: number;
  }

  /** A ball: a cushion's stuffing, a finial, a bolster. */
  export interface ISphere {
    /** Discriminator. */
    kind: "sphere";
    /** Stable collider identity within the domain. */
    id: string;
    /** World centre. */
    center: IAutoMovieVector3;
    /** Strictly positive radius in metres. */
    radius: number;
  }

  /** An axis-aligned world box: a sill, a shelf, a sofa arm, a crate. */
  export interface IBox {
    /** Discriminator. */
    kind: "box";
    /** Stable collider identity within the domain. */
    id: string;
    /** Minimum corner. */
    min: IAutoMovieVector3;
    /** Maximum corner, strictly greater on every axis. */
    max: IAutoMovieVector3;
  }

  /**
   * Shared capsule following one actor's evaluated humanoid pose.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Reuses the body capsule representation for soft contact.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Resolves moving capsule geometry before ordered collision projection.
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
 */
export interface IAutoMovieSoftWind {
  /** Direction the draught pushes; non-zero and need not be unit. */
  direction: IAutoMovieVector3;

  /** Steady component of the draught's acceleration in m/s²; may be negative. */
  acceleration: number;

  /** Amplitude of the triangular gust in m/s²; `>= 0`. */
  gustAcceleration: number;

  /** Gust frequency in Hz; `>= 0`, where `0` holds the gust at its peak. */
  gustHz: number;
}
