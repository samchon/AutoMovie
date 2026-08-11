import {
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";
import { plantingBudget } from "./planting";

/**
 * Recursion depth one planting recipe may declare.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Bounds recursive planting derivation before it executes.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Defines the supported depth of an interior planting recipe.
 */
export const PLANTING_MAX_LEVELS = 12;

/**
 * Children one branch may bear.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Bounds the branching factor of generated planting structure.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Defines the supported child population of one branch.
 */
export const PLANTING_MAX_CHILDREN = 16;

/**
 * Branch segments one recipe may cap itself at.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Caps the total structural work of planting derivation.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Defines the maximum accepted branch population.
 */
export const PLANTING_MAX_BRANCHES = 100_000;

/**
 * Leaf occurrences one recipe may cap itself at.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Caps the total foliage work of planting derivation.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Defines the maximum accepted leaf population.
 */
export const PLANTING_MAX_LEAVES = 1_000_000;

/**
 * Members one cluster may place.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Bounds the installation population before placement begins.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Defines the maximum accepted cluster membership.
 */
export const PLANTING_MAX_MEMBERS = 10_000;

/**
 * Seeded placement attempts one member may cost.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Bounds rejection sampling for every cluster member.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Defines the maximum placement work per member.
 */
export const PLANTING_MAX_ATTEMPTS = 64;

/**
 * Validate one planting recipe's branching law, growth state, pruning envelope,
 * foliage rule and budget.
 *
 * The point of the pass is that a recipe which survives it can be grown without
 * the derivation second-guessing its own input: every ratio contracts, the
 * growth span is positive so the deepest level can actually emerge, no
 * direction is the zero vector, and the complete `k`-ary tree the law describes
 * fits inside the cap the recipe declared for itself. A recipe that fails is
 * refused with the path of every offending field, never quietly clamped — a
 * clamped plant is a plant whose author was told nothing and whose frames
 * changed anyway.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Refuses a planting recipe whose structure or work exceeds the bounded tier.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Validates the procedural structure before interior planting derivation.
 * @author Samchon
 */
export const validatePlantingDomain = (props: {
  domain: IAutoMoviePlantingDomain;
}): IAutoMovieValidation => {
  const { domain } = props;
  const out = new ViolationCollector();
  const root = "$input";

  if (domain.id.trim().length === 0)
    out.push("type", `${root}.id`, "planting id must be non-empty", domain.id);
  if (domain.version !== 1)
    out.push(
      "type",
      `${root}.version`,
      `planting schema version must be 1, but was ${String(domain.version)}`,
      domain.version,
    );
  if (domain.units !== "meter")
    out.push(
      "type",
      `${root}.units`,
      `planting units must be "meter", but was ${String(domain.units)}`,
      domain.units,
    );
  if (!Number.isSafeInteger(domain.seed))
    out.push(
      "type",
      `${root}.seed`,
      "planting seed must be a safe integer",
      domain.seed,
    );

  const structure = domain.structure;
  integer(
    out,
    `${root}.structure.levels`,
    "branching levels",
    structure.levels,
    1,
    PLANTING_MAX_LEVELS,
  );
  direction(out, `${root}.structure.axis`, "trunk axis", structure.axis);
  numeric(
    out,
    `${root}.structure.length`,
    "trunk length",
    structure.length,
    0,
    true,
    Infinity,
  );
  numeric(
    out,
    `${root}.structure.radius`,
    "trunk radius",
    structure.radius,
    0,
    true,
    Infinity,
  );
  numeric(
    out,
    `${root}.structure.lengthRatio`,
    "length ratio",
    structure.lengthRatio,
    0,
    true,
    1,
  );
  numeric(
    out,
    `${root}.structure.radiusRatio`,
    "radius ratio",
    structure.radiusRatio,
    0,
    true,
    1,
  );
  numeric(
    out,
    `${root}.structure.directionJitter`,
    "direction jitter",
    structure.directionJitter,
    0,
    false,
    1,
  );
  numeric(
    out,
    `${root}.structure.lengthJitter`,
    "length jitter",
    structure.lengthJitter,
    0,
    false,
    1,
  );
  numeric(
    out,
    `${root}.structure.gravitropism`,
    "gravitropism",
    structure.gravitropism,
    -1,
    false,
    1,
  );
  if (structure.children.length === 0)
    out.push(
      "type",
      `${root}.structure.children`,
      "a branching law must declare at least one child, or the recursion has nothing to do",
      structure.children.length,
    );
  if (structure.children.length > PLANTING_MAX_CHILDREN)
    out.push(
      "range",
      `${root}.structure.children`,
      `a branch may bear at most ${PLANTING_MAX_CHILDREN} children, but declared ${structure.children.length}`,
      structure.children.length,
      structure.children.length - PLANTING_MAX_CHILDREN,
    );
  const childIds = new Set<string>();
  structure.children.forEach((child, index) => {
    const path = `${root}.structure.children[${index}]`;
    identity(out, path, "child", child.id, childIds);
    direction(out, `${path}.direction`, "child direction", child.direction);
    numeric(out, `${path}.offset`, "child offset", child.offset, 0, false, 1);
  });

  numeric(
    out,
    `${root}.growth.stage`,
    "growth stage",
    domain.growth.stage,
    0,
    false,
    1,
  );
  numeric(
    out,
    `${root}.growth.onset`,
    "growth onset",
    domain.growth.onset,
    0,
    false,
    1,
  );
  const spanned = domain.growth.onset * (structure.levels - 1);
  if (Number.isFinite(spanned) && spanned >= 1)
    out.push(
      "range",
      `${root}.growth.onset`,
      `onset * (levels - 1) must stay below 1, or the deepest level could never emerge, but it is ${spanned}`,
      domain.growth.onset,
      spanned - 1,
    );

  if (domain.pruning.kind === "box") {
    vector(out, `${root}.pruning.min`, domain.pruning.min);
    vector(out, `${root}.pruning.max`, domain.pruning.max);
    for (const axis of ["x", "y", "z"] as const)
      if (domain.pruning.max[axis] <= domain.pruning.min[axis])
        out.push(
          "range",
          `${root}.pruning.max.${axis}`,
          `pruning box max ${axis} must be strictly above its min (${domain.pruning.min[axis]})`,
          domain.pruning.max[axis],
        );
  } else if (domain.pruning.kind === "sphere") {
    vector(out, `${root}.pruning.center`, domain.pruning.center);
    numeric(
      out,
      `${root}.pruning.radius`,
      "pruning radius",
      domain.pruning.radius,
      0,
      true,
      Infinity,
    );
  }

  if (domain.foliage !== null) {
    numeric(
      out,
      `${root}.foliage.density`,
      "foliage density",
      domain.foliage.density,
      0,
      true,
      Infinity,
    );
    integer(
      out,
      `${root}.foliage.minLevel`,
      "foliage minimum level",
      domain.foliage.minLevel,
      0,
      PLANTING_MAX_LEVELS,
    );
    for (const axis of ["x", "y", "z"] as const)
      numeric(
        out,
        `${root}.foliage.size.${axis}`,
        `leaf size ${axis}`,
        domain.foliage.size[axis],
        0,
        true,
        Infinity,
      );
    numeric(
      out,
      `${root}.foliage.scaleJitter`,
      "leaf scale jitter",
      domain.foliage.scaleJitter,
      0,
      false,
      1,
    );
    numeric(
      out,
      `${root}.foliage.rollJitter`,
      "leaf roll jitter",
      domain.foliage.rollJitter,
      0,
      false,
      1,
    );
  }

  integer(
    out,
    `${root}.budget.maxBranches`,
    "branch cap",
    domain.budget.maxBranches,
    1,
    PLANTING_MAX_BRANCHES,
  );
  integer(
    out,
    `${root}.budget.maxLeaves`,
    "leaf cap",
    domain.budget.maxLeaves,
    0,
    PLANTING_MAX_LEAVES,
  );
  // Guarded by the level range above: the worst case is counted by walking the
  // levels, so an out-of-range depth is refused before anything walks it.
  if (
    Number.isSafeInteger(structure.levels) &&
    structure.levels >= 1 &&
    structure.levels <= PLANTING_MAX_LEVELS
  ) {
    const budget = plantingBudget({ domain });
    if (
      Number.isSafeInteger(domain.budget.maxBranches) &&
      budget.worstCaseBranches > domain.budget.maxBranches
    )
      out.push(
        "range",
        `${root}.budget.maxBranches`,
        `the declared branching law grows ${budget.worstCaseBranches} segments unpruned, which its own cap of ${domain.budget.maxBranches} refuses`,
        domain.budget.maxBranches,
        budget.worstCaseBranches - domain.budget.maxBranches,
      );
    // The leaf cap is refused here for the same reason the branch cap is: it is
    // enforced by throwing while blades are emitted, and a derivation that
    // throws inside a binding's own validation is a crash where a violation was
    // asked for. A recipe with no foliage rule bears nothing, so there is no
    // emission to bound and the cap is only its own range check's business.
    if (
      domain.foliage !== null &&
      budget.worstCaseLeaves > domain.budget.maxLeaves
    )
      out.push(
        "range",
        `${root}.budget.maxLeaves`,
        `the declared foliage rule bears ${budget.worstCaseLeaves} blades on an unpruned structure, which its own cap of ${domain.budget.maxLeaves} refuses`,
        domain.budget.maxLeaves,
        budget.worstCaseLeaves - domain.budget.maxLeaves,
      );
  }

  return out.toValidation();
};

/**
 * Validate one planting cluster's count, region, spacing rule and variation.
 *
 * A cluster is the arrangement half of the same product: the recipe says what a
 * plant is, the cluster says how many stand where. Refusing an impossible
 * arrangement here is what keeps {@link arrangePlantingCluster} from silently
 * returning fewer members than an author believed they had asked for.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Refuses impossible member counts, regions, spacing, and variation before placement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Validates the bounded arrangement half of an interior planting.
 * @author Samchon
 */
export const validatePlantingCluster = (props: {
  cluster: IAutoMoviePlantingCluster;
}): IAutoMovieValidation => {
  const { cluster } = props;
  const out = new ViolationCollector();
  const root = "$input";

  if (cluster.id.trim().length === 0)
    out.push("type", `${root}.id`, "cluster id must be non-empty", cluster.id);
  if (cluster.domain.trim().length === 0)
    out.push(
      "type",
      `${root}.domain`,
      "cluster must cite a planting recipe",
      cluster.domain,
    );
  integer(
    out,
    `${root}.count`,
    "member count",
    cluster.count,
    1,
    PLANTING_MAX_MEMBERS,
  );
  vector(out, `${root}.anchor`, cluster.anchor);
  numeric(
    out,
    `${root}.extent.x`,
    "extent x",
    cluster.extent.x,
    0,
    false,
    Infinity,
  );
  numeric(
    out,
    `${root}.extent.z`,
    "extent z",
    cluster.extent.z,
    0,
    false,
    Infinity,
  );
  if (!Number.isSafeInteger(cluster.seed))
    out.push(
      "type",
      `${root}.seed`,
      "cluster seed must be a safe integer",
      cluster.seed,
    );
  numeric(
    out,
    `${root}.minSpacing`,
    "minimum spacing",
    cluster.minSpacing,
    0,
    false,
    Infinity,
  );
  integer(
    out,
    `${root}.attempts`,
    "placement attempts",
    cluster.attempts,
    1,
    PLANTING_MAX_ATTEMPTS,
  );
  for (const axis of ["x", "y", "z"] as const) {
    numeric(
      out,
      `${root}.scale.min.${axis}`,
      `minimum scale ${axis}`,
      cluster.scale.min[axis],
      0,
      true,
      Infinity,
    );
    numeric(
      out,
      `${root}.scale.max.${axis}`,
      `maximum scale ${axis}`,
      cluster.scale.max[axis],
      cluster.scale.min[axis],
      false,
      Infinity,
    );
  }
  numeric(
    out,
    `${root}.yawJitter`,
    "yaw jitter",
    cluster.yawJitter,
    0,
    false,
    1,
  );

  return out.toValidation();
};

/** A non-zero finite direction vector. */
const direction = (
  out: ViolationCollector,
  path: string,
  label: string,
  value: IAutoMovieVector3,
): void => {
  vector(out, path, value);
  if (
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z) &&
    value.x * value.x + value.y * value.y + value.z * value.z === 0
  )
    out.push("type", path, `${label} must be a non-zero vector`, value);
};

/** Every component of an authored vector must be a real number. */
const vector = (
  out: ViolationCollector,
  path: string,
  value: IAutoMovieVector3,
): void => {
  for (const axis of ["x", "y", "z"] as const)
    numeric(
      out,
      `${path}.${axis}`,
      `${axis} component`,
      value[axis],
      -Infinity,
      false,
      Infinity,
    );
};

/** A finite scalar inside `[min, max]`, or `(min, max]` when `exclusive`. */
const numeric = (
  out: ViolationCollector,
  path: string,
  label: string,
  value: number,
  min: number,
  exclusive: boolean,
  max: number,
): void => {
  if (
    !Number.isFinite(value) ||
    (exclusive ? value <= min : value < min) ||
    value > max
  )
    out.push(
      "range",
      path,
      `${label} must be finite within ${exclusive ? "(" : "["}${min}, ${max}]`,
      value,
    );
};

/** A safe integer inside `[min, max]`. */
const integer = (
  out: ViolationCollector,
  path: string,
  label: string,
  value: number,
  min: number,
  max: number,
): void => {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    out.push(
      "type",
      path,
      `${label} must be an integer within [${min}, ${max}]`,
      value,
    );
};

/** A non-empty id that has not already been used by a sibling. */
const identity = (
  out: ViolationCollector,
  path: string,
  label: string,
  id: string,
  seen: Set<string>,
): void => {
  if (id.trim().length === 0)
    out.push("type", `${path}.id`, `${label} id must be non-empty`, id);
  else if (seen.has(id))
    out.push("type", `${path}.id`, `${label} id "${id}" is duplicated`, id);
  seen.add(id);
};
