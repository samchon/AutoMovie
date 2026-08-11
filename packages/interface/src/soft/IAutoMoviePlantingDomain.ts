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
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingDomain` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingDomain` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingDomain {
  /**
   * Schema version.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `version` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `version` for the interior space soft furnishing planting system contract.
   */
  version: 1;

  /**
   * Stable identity of this planting recipe.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `id` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
   */
  id: string;

  /**
   * All authored lengths are measured in metres.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `units` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `units` for the interior space soft furnishing planting system contract.
   */
  units: "meter";

  /**
   * Deterministic seed; any safe integer.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `seed` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `seed` for the interior space soft furnishing planting system contract.
   */
  seed: number;

  /**
   * The recursive branching law.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `structure` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `structure` for the interior space soft furnishing planting system contract.
   */
  structure: IAutoMoviePlantingStructure;

  /**
   * How far along that law this plant has actually grown.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `growth` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `growth` for the interior space soft furnishing planting system contract.
   */
  growth: IAutoMoviePlantingGrowth;

  /**
   * The volume the plant is kept inside: a clipped hedge, a trained wall.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `pruning` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `pruning` for the interior space soft furnishing planting system contract.
   */
  pruning: IAutoMoviePruningEnvelope;

  /**
   * The leaf rule, or `null` for a bare structure such as a winter branch.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `foliage` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `foliage` for the interior space soft furnishing planting system contract.
   */
  foliage: IAutoMoviePlantingFoliage | null;

  /**
   * Hard caps this recipe promises to stay inside.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `budget` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `budget` for the interior space soft furnishing planting system contract.
   */
  budget: IAutoMoviePlantingLimits;
}

/**
 * The recursive branching law, free of any species classification.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IAutoMoviePlantingStructure` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingStructure` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingStructure {
  /**
   * Recursion depth; an integer of at least 1. Level `0` is the trunk.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `levels` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `levels` for the interior space soft furnishing planting system contract.
   */
  levels: number;

  /**
   * Growth direction of the trunk in world space; non-zero, need not be unit.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `axis` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `axis` for the interior space soft furnishing planting system contract.
   */
  axis: IAutoMovieVector3;

  /**
   * Trunk length in metres at full growth; strictly positive.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `length` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `length` for the interior space soft furnishing planting system contract.
   */
  length: number;

  /**
   * Trunk radius in metres at its base; strictly positive.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `radius` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `radius` for the interior space soft furnishing planting system contract.
   */
  radius: number;

  /**
   * Child length divided by parent length; in `(0, 1]`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `lengthRatio` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `lengthRatio` for the interior space soft furnishing planting system contract.
   */
  lengthRatio: number;

  /**
   * Child radius divided by parent radius; in `(0, 1]`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `radiusRatio` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `radiusRatio` for the interior space soft furnishing planting system contract.
   */
  radiusRatio: number;

  /**
   * The children every branch bears, in authored order. At least one, so the
   * recursion has something to do; the branching pattern of a whole plant is
   * this short list applied at every level.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `children` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `children` for the interior space soft furnishing planting system contract.
   */
  children: IAutoMoviePlantingChild[];

  /**
   * Seeded perturbation of each child's direction, in `[0, 1]`. `0` grows a
   * perfectly regular lattice of a plant; `1` fully randomizes the offset
   * before the direction is renormalized.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `directionJitter` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `directionJitter` for the interior space soft furnishing planting system contract.
   */
  directionJitter: number;

  /**
   * Seeded relative perturbation of each child's length, in `[0, 1)`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `lengthJitter` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `lengthJitter` for the interior space soft furnishing planting system contract.
   */
  lengthJitter: number;

  /**
   * Bias of every child direction toward world vertical, in `[-1, 1]`. Positive
   * droops toward `-y` (a weeping habit, a hanging basket); negative lifts
   * toward `+y` (a columnar habit); `0` follows the authored direction
   * exactly.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `gravitropism` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `gravitropism` for the interior space soft furnishing planting system contract.
   */
  gravitropism: number;
}

/**
 * One child branch's placement in its parent's frame.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingChild` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingChild` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingChild {
  /**
   * Stable child identity within the structure.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `id` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
   */
  id: string;

  /**
   * Direction in the parent's frame, non-zero and need not be unit. `+y` is the
   * parent's own growth axis; `+x` and `+z` are a deterministic perpendicular
   * pair derived from that axis alone, so the same child vector means the same
   * thing wherever the parent points.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `direction` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `direction` for the interior space soft furnishing planting system contract.
   */
  direction: IAutoMovieVector3;

  /**
   * Where along the parent it emerges, in `[0, 1]` of the parent's length.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `offset` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `offset` for the interior space soft furnishing planting system contract.
   */
  offset: number;
}

/**
 * How far along its branching law a plant has actually grown.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingGrowth` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingGrowth` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingGrowth {
  /**
   * Growth state in `[0, 1]`. `0` is a plant that has not emerged at all and
   * emits nothing; `1` is the fully extended structure.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `stage` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `stage` for the interior space soft furnishing planting system contract.
   */
  stage: number;

  /**
   * Delay between consecutive levels, in `[0, 1)`. Level `l` starts extending
   * at `stage = onset * l`, so a young plant is a trunk with stubs and an old
   * one carries every order of branching. `onset * (levels − 1)` must stay
   * below `1`, or the deepest level could never emerge.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `onset` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `onset` for the interior space soft furnishing planting system contract.
   */
  onset: number;
}

/**
 * The volume a plant is kept inside.
 *
 * A branch whose base is already outside is not grown at all; a branch that
 * crosses the boundary is cut exactly at the crossing, and only the children
 * that emerge before the cut survive. That is pruning, not clipping in the
 * renderer: what the envelope removes is gone from the derived structure every
 * reader of the plant works from. The installation binding's canopy collision
 * check reads that structure today. A quantity take-off would read the same
 * one, and none measures planting yet.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePruningEnvelope` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePruningEnvelope` for the interior space soft furnishing planting system contract.
 */
export type IAutoMoviePruningEnvelope =
  | IAutoMoviePruningEnvelope.INone
  | IAutoMoviePruningEnvelope.IBox
  | IAutoMoviePruningEnvelope.ISphere;
export namespace IAutoMoviePruningEnvelope {
  /**
   * Unpruned: the structure grows to its full extent.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `INone` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `INone` for the interior space soft furnishing planting system contract.
   */
  export interface INone {
    /**
     * Discriminator.
     *
     * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `kind` as the portable data boundary for the interior soft anchor host requirement.
     * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `kind` for the interior space soft furnishing planting system contract.
     */
    kind: "none";
  }

  /**
   * An axis-aligned world box: a trained wall, a clipped hedge, a planter.
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
   * A ball: a standard topiary, a hanging sphere.
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
}

/**
 * The leaf rule.
 *
 * Leaves are emitted as full-TRS instance occurrences — translation, unit
 * quaternion and per-axis scale — because that is exactly what GPU instancing
 * consumes without loss. A leaf is never a degraded yaw or a uniform scale.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IAutoMoviePlantingFoliage` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingFoliage` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingFoliage {
  /**
   * Leaves per metre of bearing branch; strictly positive.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `density` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `density` for the interior space soft furnishing planting system contract.
   */
  density: number;

  /**
   * Lowest branch level that bears leaves; an integer `>= 0`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `minLevel` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `minLevel` for the interior space soft furnishing planting system contract.
   */
  minLevel: number;

  /**
   * Prototype leaf size in metres on each local axis; each strictly positive.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `size` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `size` for the interior space soft furnishing planting system contract.
   */
  size: IAutoMovieVector3;

  /**
   * Seeded relative perturbation of leaf size, in `[0, 1)`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `scaleJitter` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `scaleJitter` for the interior space soft furnishing planting system contract.
   */
  scaleJitter: number;

  /**
   * Seeded roll about the bearing branch, in `[0, 1]`. `0` leaves every blade
   * in the branch's own frame; `1` spins each one anywhere around it.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `rollJitter` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `rollJitter` for the interior space soft furnishing planting system contract.
   */
  rollJitter: number;
}

/**
 * Hard caps a planting recipe promises to stay inside.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IAutoMoviePlantingLimits` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingLimits` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingLimits {
  /**
   * Branch segments this recipe may emit; a positive integer.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `maxBranches` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `maxBranches` for the interior space soft furnishing planting system contract.
   */
  maxBranches: number;

  /**
   * Leaf occurrences this recipe may emit; a non-negative integer.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `maxLeaves` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `maxLeaves` for the interior space soft furnishing planting system contract.
   */
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
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `IAutoMoviePlantingCluster` as the portable data boundary for the interior soft collision clearance requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingCluster` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingCluster {
  /**
   * Stable cluster identity within the production.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `id` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
   */
  id: string;

  /**
   * Id of the planting recipe every member grows from.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `domain` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `domain` for the interior space soft furnishing planting system contract.
   */
  domain: string;

  /**
   * Members to place; an integer of at least 1.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `count` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `count` for the interior space soft furnishing planting system contract.
   */
  count: number;

  /**
   * World centre of the placement rectangle.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `anchor` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `anchor` for the interior space soft furnishing planting system contract.
   */
  anchor: IAutoMovieVector3;

  /**
   * Half-extent of the placement rectangle in metres; each `>= 0`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `extent` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `extent` for the interior space soft furnishing planting system contract.
   */
  extent: IAutoMoviePlantingExtent;

  /**
   * Deterministic seed; any safe integer.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `seed` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `seed` for the interior space soft furnishing planting system contract.
   */
  seed: number;

  /**
   * Centre-to-centre distance members must keep, in metres; `>= 0`. A member
   * that cannot be placed within {@link attempts} tries is refused and counted,
   * never squeezed in: a cluster that quietly overlapped would be a cluster
   * whose author was told nothing and whose frames changed anyway.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `minSpacing` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `minSpacing` for the interior space soft furnishing planting system contract.
   */
  minSpacing: number;

  /**
   * Seeded placement attempts per member; an integer of at least 1.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `attempts` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `attempts` for the interior space soft furnishing planting system contract.
   */
  attempts: number;

  /**
   * Per-axis scale range every member is drawn from.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `scale` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `scale` for the interior space soft furnishing planting system contract.
   */
  scale: IAutoMoviePlantingScaleRange;

  /**
   * Seeded turn about world `+y`, in `[0, 1]`. `0` faces every member the same
   * way; `1` turns each anywhere. The turn is blended toward identity as a
   * normalized quaternion interpolation, so a partial jitter is a partial
   * rotation rather than a scaled angle no trigonometry-free derivation could
   * reproduce exactly.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-collision-clearance Exposes `yawJitter` as the portable data boundary for the interior soft collision clearance requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `yawJitter` for the interior space soft furnishing planting system contract.
   */
  yawJitter: number;
}

/**
 * Half-extent of a placement rectangle on the ground plane.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `IAutoMoviePlantingExtent` as the portable data boundary for the interior plant placement state requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingExtent` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingExtent {
  /**
   * Half-extent along world `x` in metres; `>= 0`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `x` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `x` for the interior space soft furnishing planting system contract.
   */
  x: number;

  /**
   * Half-extent along world `z` in metres; `>= 0`.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Exposes `z` as the portable data boundary for the interior plant placement state requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `z` for the interior space soft furnishing planting system contract.
   */
  z: number;
}

/**
 * The per-axis scale range cluster members are drawn from.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IAutoMoviePlantingScaleRange` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMoviePlantingScaleRange` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMoviePlantingScaleRange {
  /**
   * Minimum per-axis scale; each strictly positive.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `min` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `min` for the interior space soft furnishing planting system contract.
   */
  min: IAutoMovieVector3;

  /**
   * Maximum per-axis scale; each at least the matching minimum.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `max` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `max` for the interior space soft furnishing planting system contract.
   */
  max: IAutoMovieVector3;
}
