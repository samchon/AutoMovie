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
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingState` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingState` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingState {
  /**
   * Identity of the recipe this structure was derived from.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `domain` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `domain` for the interior space soft furnishing planting system contract.
   */
  domain: string;

  /**
   * Growth state the structure was derived at.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `stage` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `stage` for the interior space soft furnishing planting system contract.
   */
  stage: number;

  /**
   * Branch segments in a stable depth-first authored order.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `branches` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `branches` for the interior space soft furnishing planting system contract.
   */
  branches: IAutoMoviePlantingBranch[];

  /**
   * Leaf occurrences, in the order of the branches that bear them.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `leaves` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `leaves` for the interior space soft furnishing planting system contract.
   */
  leaves: IAutoMoviePlantingLeaf[];

  /**
   * Recipe-frame extent of the derived structure, or `null` when nothing
   * emerged at all — a plant at growth state `0`, or one pruned away entirely.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `bounds` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `bounds` for the interior space soft furnishing planting system contract.
   */
  bounds: IAutoMovieSoftBounds | null;
}

/**
 * One tapered branch segment.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingBranch` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingBranch` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingBranch {
  /**
   * Stable branch identity, derived from the path of child ids that made it.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `id` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
   */
  id: string;

  /**
   * Id of the branch this one emerges from, or `null` for the trunk.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `parent` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `parent` for the interior space soft furnishing planting system contract.
   */
  parent: string | null;

  /**
   * Recursion level; `0` is the trunk.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `level` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `level` for the interior space soft furnishing planting system contract.
   */
  level: number;

  /**
   * Recipe-frame position of the base.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `start` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `start` for the interior space soft furnishing planting system contract.
   */
  start: IAutoMovieVector3;

  /**
   * Recipe-frame position of the tip, after growth and pruning.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `end` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `end` for the interior space soft furnishing planting system contract.
   */
  end: IAutoMovieVector3;

  /**
   * Radius in metres at the base.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `radiusStart` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `radiusStart` for the interior space soft furnishing planting system contract.
   */
  radiusStart: number;

  /**
   * Radius in metres at the tip.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `radiusEnd` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `radiusEnd` for the interior space soft furnishing planting system contract.
   */
  radiusEnd: number;

  /**
   * Whether the pruning envelope cut this segment short.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `pruned` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `pruned` for the interior space soft furnishing planting system contract.
   */
  pruned: boolean;
}

/**
 * One leaf occurrence, as a lossless full-TRS instance.
 *
 * Translation, a unit quaternion and a per-axis scale, which is exactly what
 * GPU instancing consumes. A leaf is never reduced to a yaw or to one uniform
 * number, because a reduction is a fact about the plant that nobody authored.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingLeaf` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingLeaf` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingLeaf {
  /**
   * Stable leaf identity within the derived structure.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `id` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
   */
  id: string;

  /**
   * Id of the branch bearing this leaf.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `branch` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `branch` for the interior space soft furnishing planting system contract.
   */
  branch: string;

  /**
   * Recipe-frame position of the leaf's origin.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `translation` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `translation` for the interior space soft furnishing planting system contract.
   */
  translation: IAutoMovieVector3;

  /**
   * Unit quaternion in glTF `(x, y, z, w)` order.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `rotation` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `rotation` for the interior space soft furnishing planting system contract.
   */
  rotation: IAutoMovieQuaternion;

  /**
   * Per-axis scale of the prototype leaf; each strictly positive.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `scale` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `scale` for the interior space soft furnishing planting system contract.
   */
  scale: IAutoMovieVector3;
}

/**
 * The deterministic arrangement of one planting cluster.
 *
 * Members are generated from the cluster seed alone, so the same cluster is the
 * same arrangement everywhere, and refusals are counted rather than hidden.
 *
 * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `IAutoMoviePlantingArrangement` as the portable data boundary for the map vegetation individual cluster requirement.
 * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `IAutoMoviePlantingArrangement` for the world site vegetation layer form input system contract.
 */
export interface IAutoMoviePlantingArrangement {
  /**
   * Identity of the cluster this arrangement was derived from.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `cluster` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `cluster` for the world site vegetation layer form input system contract.
   */
  cluster: string;

  /**
   * Identity of the recipe every member grows from.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `domain` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `domain` for the world site vegetation layer form input system contract.
   */
  domain: string;

  /**
   * Accepted members, in authored slot order.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `placements` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `placements` for the world site vegetation layer form input system contract.
   */
  placements: IAutoMoviePlantingPlacement[];

  /**
   * Members refused because no attempt honoured the minimum spacing.
   *
   * Reported rather than absorbed: a cluster asked for `count` plants and got
   * fewer, and the number that did not fit is the evidence an author needs to
   * widen the bed or loosen the spacing.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `rejected` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `rejected` for the world site vegetation layer form input system contract.
   */
  rejected: number;

  /**
   * World extent of the accepted placements, or `null` when none were.
   *
   * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster Exposes `bounds` as the portable data boundary for the map vegetation individual cluster requirement.
   * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input Types `bounds` for the world site vegetation layer form input system contract.
   */
  bounds: IAutoMovieSoftBounds | null;
}

/**
 * One accepted cluster member, as a lossless full-TRS instance.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingPlacement` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingPlacement` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingPlacement {
  /**
   * Stable placement identity within the cluster.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `id` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
   */
  id: string;

  /**
   * Authored slot index this placement satisfied.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `slot` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `slot` for the interior space soft furnishing planting system contract.
   */
  slot: number;

  /**
   * World position of the member's base.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `translation` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `translation` for the interior space soft furnishing planting system contract.
   */
  translation: IAutoMovieVector3;

  /**
   * Unit quaternion in glTF `(x, y, z, w)` order.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `rotation` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `rotation` for the interior space soft furnishing planting system contract.
   */
  rotation: IAutoMovieQuaternion;

  /**
   * Per-axis scale; each strictly positive.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `scale` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `scale` for the interior space soft furnishing planting system contract.
   */
  scale: IAutoMovieVector3;
}

/**
 * The bounded cost a planting recipe and its cluster add to a shot.
 *
 * Every field is derived from the records alone, so a production can be refused
 * for an unaffordable green wall before a single branch is grown.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingBudget` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingBudget` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingBudget {
  /**
   * Identity of the measured recipe.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `domain` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `domain` for the interior space soft furnishing planting system contract.
   */
  domain: string;

  /**
   * Branch segments a fully grown, unpruned structure would emit.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `worstCaseBranches` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `worstCaseBranches` for the interior space soft furnishing planting system contract.
   */
  worstCaseBranches: number;

  /**
   * Leaf occurrences a fully grown, unpruned structure would emit, or `0` for a
   * recipe with no foliage rule.
   *
   * Derived from the density rule and the branching law rather than read off
   * {@link maxLeaves}: a cap is what the recipe promises not to exceed, not what
   * it costs, and a bare winter branch that reported its cap would hand a
   * render budget a bill for foliage nobody grows.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `worstCaseLeaves` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `worstCaseLeaves` for the interior space soft furnishing planting system contract.
   */
  worstCaseLeaves: number;

  /**
   * Declared branch cap.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `maxBranches` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `maxBranches` for the interior space soft furnishing planting system contract.
   */
  maxBranches: number;

  /**
   * Declared leaf cap.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `maxLeaves` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `maxLeaves` for the interior space soft furnishing planting system contract.
   */
  maxLeaves: number;

  /**
   * Cluster members requested, or `1` when the recipe stands alone.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `members` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `members` for the interior space soft furnishing planting system contract.
   */
  members: number;

  /**
   * Worst-case branch instances the renderer would draw over every member.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `worstCaseBranchInstances` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `worstCaseBranchInstances` for the interior space soft furnishing planting system contract.
   */
  worstCaseBranchInstances: number;

  /**
   * Worst-case leaf instances the renderer would draw over every member.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `worstCaseLeafInstances` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `worstCaseLeafInstances` for the interior space soft furnishing planting system contract.
   */
  worstCaseLeafInstances: number;
}
