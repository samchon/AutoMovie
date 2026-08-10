import { IAutoMovieQuaternion } from "../geometry/IAutoMovieQuaternion";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieSoftBounds } from "./IAutoMovieSoftBodyState";

/**
 * The derived structure of one planting recipe at its authored growth state.
 *
 * A pure function of the recipe. Nothing accumulates between calls, so two
 * derivations of the same record are bit-identical and a plant re-derived in a
 * later chunk of the same render is the same plant.
 *
 * Every coordinate here is in the **recipe's own frame**, with the trunk's base
 * at the origin. That is what makes one derived structure serve a whole bed:
 * the cluster's placements carry the world transforms, and a renderer composes
 * the two. A consumer that read these as world coordinates would draw forty
 * ferns on top of each other at the origin.
 */
export interface IAutoMoviePlantingState {
  /** Identity of the recipe this structure was derived from. */
  domain: string;

  /** Growth state the structure was derived at. */
  stage: number;

  /** Branch segments in a stable depth-first authored order. */
  branches: IAutoMoviePlantingBranch[];

  /** Leaf occurrences, in the order of the branches that bear them. */
  leaves: IAutoMoviePlantingLeaf[];

  /**
   * Recipe-frame extent of the derived structure, or `null` when nothing
   * emerged at all — a plant at growth state `0`, or one pruned away entirely.
   */
  bounds: IAutoMovieSoftBounds | null;
}

/** One tapered branch segment. */
export interface IAutoMoviePlantingBranch {
  /** Stable branch identity, derived from the path of child ids that made it. */
  id: string;

  /** Id of the branch this one emerges from, or `null` for the trunk. */
  parent: string | null;

  /** Recursion level; `0` is the trunk. */
  level: number;

  /** Recipe-frame position of the base. */
  start: IAutoMovieVector3;

  /** Recipe-frame position of the tip, after growth and pruning. */
  end: IAutoMovieVector3;

  /** Radius in metres at the base. */
  radiusStart: number;

  /** Radius in metres at the tip. */
  radiusEnd: number;

  /** Whether the pruning envelope cut this segment short. */
  pruned: boolean;
}

/**
 * One leaf occurrence, as a lossless full-TRS instance.
 *
 * Translation, a unit quaternion and a per-axis scale, which is exactly what
 * GPU instancing consumes. A leaf is never reduced to a yaw or to one uniform
 * number, because a reduction is a fact about the plant that nobody authored.
 */
export interface IAutoMoviePlantingLeaf {
  /** Stable leaf identity within the derived structure. */
  id: string;

  /** Id of the branch bearing this leaf. */
  branch: string;

  /** Recipe-frame position of the leaf's origin. */
  translation: IAutoMovieVector3;

  /** Unit quaternion in glTF `(x, y, z, w)` order. */
  rotation: IAutoMovieQuaternion;

  /** Per-axis scale of the prototype leaf; each strictly positive. */
  scale: IAutoMovieVector3;
}

/**
 * The deterministic arrangement of one planting cluster.
 *
 * Members are generated from the cluster seed alone, so the same cluster is the
 * same arrangement everywhere, and refusals are counted rather than hidden.
 */
export interface IAutoMoviePlantingArrangement {
  /** Identity of the cluster this arrangement was derived from. */
  cluster: string;

  /** Identity of the recipe every member grows from. */
  domain: string;

  /** Accepted members, in authored slot order. */
  placements: IAutoMoviePlantingPlacement[];

  /**
   * Members refused because no attempt honoured the minimum spacing.
   *
   * Reported rather than absorbed: a cluster asked for `count` plants and got
   * fewer, and the number that did not fit is the evidence an author needs to
   * widen the bed or loosen the spacing.
   */
  rejected: number;

  /** World extent of the accepted placements, or `null` when none were. */
  bounds: IAutoMovieSoftBounds | null;
}

/** One accepted cluster member, as a lossless full-TRS instance. */
export interface IAutoMoviePlantingPlacement {
  /** Stable placement identity within the cluster. */
  id: string;

  /** Authored slot index this placement satisfied. */
  slot: number;

  /** World position of the member's base. */
  translation: IAutoMovieVector3;

  /** Unit quaternion in glTF `(x, y, z, w)` order. */
  rotation: IAutoMovieQuaternion;

  /** Per-axis scale; each strictly positive. */
  scale: IAutoMovieVector3;
}

/**
 * The bounded cost a planting recipe and its cluster add to a shot.
 *
 * Every field is derived from the records alone, so a production can be refused
 * for an unaffordable green wall before a single branch is grown.
 */
export interface IAutoMoviePlantingBudget {
  /** Identity of the measured recipe. */
  domain: string;

  /** Branch segments a fully grown, unpruned structure would emit. */
  worstCaseBranches: number;

  /**
   * Leaf occurrences a fully grown, unpruned structure would emit, or `0` for a
   * recipe with no foliage rule.
   *
   * Derived from the density rule and the branching law rather than read off
   * {@link maxLeaves}: a cap is what the recipe promises not to exceed, not what
   * it costs, and a bare winter branch that reported its cap would hand a
   * render budget a bill for foliage nobody grows.
   */
  worstCaseLeaves: number;

  /** Declared branch cap. */
  maxBranches: number;

  /** Declared leaf cap. */
  maxLeaves: number;

  /** Cluster members requested, or `1` when the recipe stands alone. */
  members: number;

  /** Worst-case branch instances the renderer would draw over every member. */
  worstCaseBranchInstances: number;

  /** Worst-case leaf instances the renderer would draw over every member. */
  worstCaseLeafInstances: number;
}
