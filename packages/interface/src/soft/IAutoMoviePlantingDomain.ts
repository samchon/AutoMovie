import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * One deterministic planting recipe: a branching structure, a growth state, a
 * pruning envelope and a foliage rule.
 *
 * There is **no species catalogue** here, and there will not be one. A fern, a
 * ficus, a wall of ivy and an aquatic reed differ by branching angles, ratios,
 * growth direction and leaf density, not by a name the engine would have to
 * recognise; shipping a `"monstera"` preset would be shipping content dressed
 * as capability. What a customer models is theirs. What this record provides is
 * the general parametric law and the deterministic derivation of it.
 *
 * Growth is a **state**, not an animation:
 * {@link IAutoMoviePlantingGrowth.stage} is a scalar in `[0, 1]` and the derived
 * structure is a pure function of the whole record, so the same plant at the
 * same stage is the same plant on every machine and in every re-render.
 *
 * Nothing in the derivation uses a transcendental function. Branch directions
 * are authored as vectors rather than angles and seeded variation is built from
 * uniform samples and square roots, so only operations IEEE-754 specifies
 * exactly ever touch a coordinate. A plant whose leaves land differently on
 * Windows and POSIX is not a deterministic plant.
 */
export interface IAutoMoviePlantingDomain {
  /** Schema version. */
  version: 1;

  /** Stable identity of this planting recipe. */
  id: string;

  /** All authored lengths are measured in metres. */
  units: "meter";

  /** Deterministic seed; any safe integer. */
  seed: number;

  /** The recursive branching law. */
  structure: IAutoMoviePlantingStructure;

  /** How far along that law this plant has actually grown. */
  growth: IAutoMoviePlantingGrowth;

  /** The volume the plant is kept inside: a clipped hedge, a trained wall. */
  pruning: IAutoMoviePruningEnvelope;

  /** The leaf rule, or `null` for a bare structure such as a winter branch. */
  foliage: IAutoMoviePlantingFoliage | null;

  /** Hard caps this recipe promises to stay inside. */
  budget: IAutoMoviePlantingLimits;
}

/** The recursive branching law, free of any species classification. */
export interface IAutoMoviePlantingStructure {
  /** Recursion depth; an integer of at least 1. Level `0` is the trunk. */
  levels: number;

  /** Growth direction of the trunk in world space; non-zero, need not be unit. */
  axis: IAutoMovieVector3;

  /** Trunk length in metres at full growth; strictly positive. */
  length: number;

  /** Trunk radius in metres at its base; strictly positive. */
  radius: number;

  /** Child length divided by parent length; in `(0, 1]`. */
  lengthRatio: number;

  /** Child radius divided by parent radius; in `(0, 1]`. */
  radiusRatio: number;

  /**
   * The children every branch bears, in authored order. At least one, so the
   * recursion has something to do; the branching pattern of a whole plant is
   * this short list applied at every level.
   */
  children: IAutoMoviePlantingChild[];

  /**
   * Seeded perturbation of each child's direction, in `[0, 1]`. `0` grows a
   * perfectly regular lattice of a plant; `1` fully randomizes the offset
   * before the direction is renormalized.
   */
  directionJitter: number;

  /** Seeded relative perturbation of each child's length, in `[0, 1)`. */
  lengthJitter: number;

  /**
   * Bias of every child direction toward world vertical, in `[-1, 1]`. Positive
   * droops toward `-y` (a weeping habit, a hanging basket); negative lifts
   * toward `+y` (a columnar habit); `0` follows the authored direction
   * exactly.
   */
  gravitropism: number;
}

/** One child branch's placement in its parent's frame. */
export interface IAutoMoviePlantingChild {
  /** Stable child identity within the structure. */
  id: string;

  /**
   * Direction in the parent's frame, non-zero and need not be unit. `+y` is the
   * parent's own growth axis; `+x` and `+z` are a deterministic perpendicular
   * pair derived from that axis alone, so the same child vector means the same
   * thing wherever the parent points.
   */
  direction: IAutoMovieVector3;

  /** Where along the parent it emerges, in `[0, 1]` of the parent's length. */
  offset: number;
}

/** How far along its branching law a plant has actually grown. */
export interface IAutoMoviePlantingGrowth {
  /**
   * Growth state in `[0, 1]`. `0` is a plant that has not emerged at all and
   * emits nothing; `1` is the fully extended structure.
   */
  stage: number;

  /**
   * Delay between consecutive levels, in `[0, 1)`. Level `l` starts extending
   * at `stage = onset * l`, so a young plant is a trunk with stubs and an old
   * one carries every order of branching. `onset * (levels − 1)` must stay
   * below `1`, or the deepest level could never emerge.
   */
  onset: number;
}

/**
 * The volume a plant is kept inside.
 *
 * A branch whose base is already outside is not grown at all; a branch that
 * crosses the boundary is cut exactly at the crossing, and only the children
 * that emerge before the cut survive. That is pruning, not clipping in the
 * renderer: the derived structure is what a quantity take-off and a collision
 * check both read.
 */
export type IAutoMoviePruningEnvelope =
  | IAutoMoviePruningEnvelope.INone
  | IAutoMoviePruningEnvelope.IBox
  | IAutoMoviePruningEnvelope.ISphere;
export namespace IAutoMoviePruningEnvelope {
  /** Unpruned: the structure grows to its full extent. */
  export interface INone {
    /** Discriminator. */
    kind: "none";
  }

  /** An axis-aligned world box: a trained wall, a clipped hedge, a planter. */
  export interface IBox {
    /** Discriminator. */
    kind: "box";
    /** Minimum corner. */
    min: IAutoMovieVector3;
    /** Maximum corner, strictly greater on every axis. */
    max: IAutoMovieVector3;
  }

  /** A ball: a standard topiary, a hanging sphere. */
  export interface ISphere {
    /** Discriminator. */
    kind: "sphere";
    /** World centre. */
    center: IAutoMovieVector3;
    /** Strictly positive radius in metres. */
    radius: number;
  }
}

/**
 * The leaf rule.
 *
 * Leaves are emitted as full-TRS instance occurrences — translation, unit
 * quaternion and per-axis scale — because that is exactly what GPU instancing
 * consumes without loss. A leaf is never a degraded yaw or a uniform scale.
 */
export interface IAutoMoviePlantingFoliage {
  /** Leaves per metre of bearing branch; strictly positive. */
  density: number;

  /** Lowest branch level that bears leaves; an integer `>= 0`. */
  minLevel: number;

  /** Prototype leaf size in metres on each local axis; each strictly positive. */
  size: IAutoMovieVector3;

  /** Seeded relative perturbation of leaf size, in `[0, 1)`. */
  scaleJitter: number;

  /**
   * Seeded roll about the bearing branch, in `[0, 1]`. `0` leaves every blade
   * in the branch's own frame; `1` spins each one anywhere around it.
   */
  rollJitter: number;
}

/** Hard caps a planting recipe promises to stay inside. */
export interface IAutoMoviePlantingLimits {
  /** Branch segments this recipe may emit; a positive integer. */
  maxBranches: number;

  /** Leaf occurrences this recipe may emit; a non-negative integer. */
  maxLeaves: number;
}

/**
 * A deterministic arrangement of one planting recipe: a planter group, a green
 * wall, a bed of reeds, a row of potted ferns.
 *
 * Repetition is generated, never hand-duplicated. Every member is a seeded
 * placement of the same recipe, and members are refused rather than overlapped
 * when they cannot honour {@link minSpacing}, so a cluster is a stated
 * arrangement with a stated collision rule instead of a list of coordinates
 * somebody typed.
 */
export interface IAutoMoviePlantingCluster {
  /** Stable cluster identity within the production. */
  id: string;

  /** Id of the planting recipe every member grows from. */
  domain: string;

  /** Members to place; an integer of at least 1. */
  count: number;

  /** World centre of the placement rectangle. */
  anchor: IAutoMovieVector3;

  /** Half-extent of the placement rectangle in metres; each `>= 0`. */
  extent: IAutoMoviePlantingExtent;

  /** Deterministic seed; any safe integer. */
  seed: number;

  /**
   * Centre-to-centre distance members must keep, in metres; `>= 0`. A member
   * that cannot be placed within {@link attempts} tries is refused and counted,
   * never squeezed in: a cluster that quietly overlapped would be a cluster
   * whose author was told nothing and whose frames changed anyway.
   */
  minSpacing: number;

  /** Seeded placement attempts per member; an integer of at least 1. */
  attempts: number;

  /** Per-axis scale range every member is drawn from. */
  scale: IAutoMoviePlantingScaleRange;

  /**
   * Seeded turn about world `+y`, in `[0, 1]`. `0` faces every member the same
   * way; `1` turns each anywhere. The turn is blended toward identity as a
   * normalized quaternion interpolation, so a partial jitter is a partial
   * rotation rather than a scaled angle no trigonometry-free derivation could
   * reproduce exactly.
   */
  yawJitter: number;
}

/** Half-extent of a placement rectangle on the ground plane. */
export interface IAutoMoviePlantingExtent {
  /** Half-extent along world `x` in metres; `>= 0`. */
  x: number;

  /** Half-extent along world `z` in metres; `>= 0`. */
  z: number;
}

/** The per-axis scale range cluster members are drawn from. */
export interface IAutoMoviePlantingScaleRange {
  /** Minimum per-axis scale; each strictly positive. */
  min: IAutoMovieVector3;

  /** Maximum per-axis scale; each at least the matching minimum. */
  max: IAutoMovieVector3;
}
