import {
  IAutoMoviePlantingArrangement,
  IAutoMoviePlantingBranch,
  IAutoMoviePlantingBudget,
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMoviePlantingLeaf,
  IAutoMoviePlantingPlacement,
  IAutoMoviePlantingState,
  IAutoMoviePruningEnvelope,
  IAutoMovieQuaternion,
  IAutoMovieSoftBounds,
  IAutoMovieVector3,
} from "@automovie/interface";

import { mixSeed, seededValue } from "../math/random";

const SALT_TRUNK = 0x74726e6b;
const SALT_LENGTH = 0x6c656e67;
const SALT_DIRECTION = 0x64697200;
const SALT_LEAF_SCALE = 0x6c656166;
const SALT_LEAF_ROLL = 0x726f6c6c;
const SALT_PLACE_X = 0x706c6378;
const SALT_PLACE_Z = 0x706c637a;
const SALT_PLACE_YAW = 0x79617700;
const SALT_PLACE_SCALE = 0x73636c00;

/**
 * Derive the branching structure of one planting recipe at its growth state.
 *
 * ## The law
 *
 * A branch at level `l` is a segment of length `Λ(l)·e(l)` along a unit axis,
 * where `Λ(l) = length · lengthRatio^l` scaled by its own seeded jitter and
 *
 * ```text
 *   e(l) = clamp( (stage − onset·l) / (1 − onset·(levels − 1)), 0, 1 )
 * ```
 *
 * Is the level's **extension**: level `0` starts extending at `stage = 0`, each
 * deeper level waits `onset` longer, and the normalizing span is exactly what
 * makes the deepest level reach `1` at `stage = 1`. Growth is therefore a state
 * and not an animation — the same recipe at the same stage is the same plant
 * everywhere, and a stage of `0` emits nothing at all rather than a seedling
 * nobody authored.
 *
 * Every branch bears the same authored child list. A child's direction is
 * stated in a frame whose `+y` is the parent's own axis and whose `+x`/`+z` are
 * the deterministic perpendicular pair of Duff et al. (2017), so one vector
 * means the same thing wherever the parent points. That direction is then bent
 * toward world vertical by `gravitropism` and perturbed by `directionJitter`
 * before being renormalized.
 *
 * ## Pruning
 *
 * A branch whose base already lies outside the envelope is not grown; a branch
 * that crosses the envelope is cut exactly at the crossing — the analytic slab
 * or quadratic root, not a sampled approximation — and only the children whose
 * emergence point precedes the cut survive. Cutting the structure rather than
 * clipping in the renderer is what lets a quantity take-off and a collision
 * check read the same plant the camera sees.
 *
 * ## Determinism
 *
 * A branch's seeded values are drawn from the recipe seed folded with the
 * **path** of child indices that produced it, never from a sequential stream,
 * so a branch's jitter does not depend on how many branches were emitted before
 * it. Nothing transcendental is evaluated: directions are authored as vectors,
 * rotations are built from the rational parameterization of the circle, and
 * only `+ − × ÷`, `Math.abs`, `Math.floor` and `Math.sqrt` ever touch a
 * coordinate. A plant reproduces bit for bit on Windows and POSIX alike.
 *
 * Throws when the derivation would exceed the recipe's own declared branch or
 * leaf cap: a budget that can be silently overrun is not a budget.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Derives the declared planting state reproducibly from its growth recipe.
 * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-layers-form `growPlanting` expands the declared trunk, branch levels, and leaf rules into an explicit bounded structural state.
 * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-season-growth The growth stage and per-level onset deterministically control branch extension and leaf emission for the declared planting state.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Implements the bounded procedural structure of an interior planting.
 * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input The generated branch and leaf records materialize the declared vegetation form without inferring an external species catalogue.
 * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-growth-season-disturbance The explicit growth-stage calculation implements the deterministic seasonal-growth subset while leaving weather and disturbance authoring upstream.
 * @author Samchon
 */
export const growPlanting = (
  domain: IAutoMoviePlantingDomain,
): IAutoMoviePlantingState => {
  const structure = domain.structure;
  const branches: IAutoMoviePlantingBranch[] = [];
  const leaves: IAutoMoviePlantingLeaf[] = [];
  const span = 1 - domain.growth.onset * (structure.levels - 1);
  const extension = (level: number): number => {
    const raw = (domain.growth.stage - domain.growth.onset * level) / span;
    if (raw <= 0) return 0;
    return raw >= 1 ? 1 : raw;
  };

  const emit = (props: {
    id: string;
    parent: string | null;
    level: number;
    key: number;
    base: IAutoMovieVector3;
    axis: IAutoMovieVector3;
    fullLength: number;
    radiusStart: number;
  }): void => {
    const reach = extension(props.level);
    if (reach === 0) return;
    if (inside(domain.pruning, props.base) === false) return;
    const length = props.fullLength * reach;
    const tip = {
      x: props.base.x + props.axis.x * length,
      y: props.base.y + props.axis.y * length,
      z: props.base.z + props.axis.z * length,
    };
    const cut = clip(domain.pruning, props.base, props.axis, length);
    const end =
      cut === null
        ? tip
        : {
            x: props.base.x + props.axis.x * cut,
            y: props.base.y + props.axis.y * cut,
            z: props.base.z + props.axis.z * cut,
          };
    const grown = cut === null ? length : cut;
    const radiusEnd = props.radiusStart * structure.radiusRatio;
    branches.push({
      id: props.id,
      parent: props.parent,
      level: props.level,
      start: props.base,
      end,
      radiusStart: props.radiusStart,
      radiusEnd,
      pruned: cut !== null,
    });
    if (branches.length > domain.budget.maxBranches)
      throw new Error(
        `planting "${domain.id}" exceeded its declared cap of ${domain.budget.maxBranches} branches`,
      );
    bearLeaves({
      domain,
      branch: props.id,
      level: props.level,
      key: props.key,
      base: props.base,
      axis: props.axis,
      length: grown,
      leaves,
    });

    if (props.level + 1 >= structure.levels) return;
    structure.children.forEach((child, index) => {
      const emergence = child.offset * length;
      if (emergence > grown) return;
      const key = mixSeed(index + 1, props.key);
      emit({
        id: `${props.id}/${child.id}`,
        parent: props.id,
        level: props.level + 1,
        key,
        base: {
          x: props.base.x + props.axis.x * emergence,
          y: props.base.y + props.axis.y * emergence,
          z: props.base.z + props.axis.z * emergence,
        },
        axis: childAxis(domain, props.axis, child.direction, key),
        fullLength:
          props.fullLength *
          structure.lengthRatio *
          jitter(domain.seed, key, SALT_LENGTH, structure.lengthJitter),
        radiusStart: radiusEnd,
      });
    });
  };

  const trunkKey = mixSeed(domain.seed, SALT_TRUNK);
  emit({
    id: "trunk",
    parent: null,
    level: 0,
    key: trunkKey,
    base: { x: 0, y: 0, z: 0 },
    axis: unitOr(structure.axis, { x: 0, y: 1, z: 0 }),
    fullLength:
      structure.length *
      jitter(domain.seed, trunkKey, SALT_LENGTH, structure.lengthJitter),
    radiusStart: structure.radius,
  });

  return {
    domain: domain.id,
    stage: domain.growth.stage,
    branches,
    leaves,
    bounds: extents(branches.flatMap((branch) => [branch.start, branch.end])),
  };
};

/**
 * Arrange one planting cluster into deterministic full-TRS placements.
 *
 * Repetition is generated, never hand-duplicated. Slot `i` draws its candidate
 * positions from `(seed, i, attempt)` alone, so the arrangement is a pure
 * function of the cluster record; a candidate is accepted only when it keeps
 * `minSpacing` from every member already placed, and a slot that cannot be
 * placed in `attempts` tries is **refused and counted** rather than squeezed in
 * on top of a neighbour.
 *
 * Acceptance necessarily reads the members already placed, so the arrangement
 * is a function of the cluster as a whole rather than of each slot
 * independently — the authored slot order is the tie-break, and it is stable.
 *
 * The spacing test is answered through a uniform grid of side `minSpacing`, so
 * a candidate compares itself against the members of nine cells rather than
 * against every member placed so far. Any member closer than `minSpacing` must
 * lie in one of those nine, so the decision is identical to the exhaustive one;
 * what changes is that the declared budget of ten thousand members at
 * sixty-four attempts is bounded work rather than a quarter of a trillion
 * distance tests. A budget a caller can exhaust the machine inside is not a
 * budget.
 *
 * Each placement carries translation, a unit quaternion and a per-axis scale,
 * which is exactly what GPU instancing consumes. Nothing is reduced to a yaw
 * angle or one uniform number on the way out.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Resolves a declared planting population into bounded member placements.
 * @evidence requirements/map/vegetation-and-ecology.md#map-vegetation-individual-cluster `arrangePlantingCluster` emits stable per-member transforms from the declared cluster count, bounds, seed, scale, tilt, and spacing refusal rule.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Produces the deterministic arrangement consumed by interior planting placement.
 * @evidence specifications/world-and-site/ecology-weather-and-calendar.md#world-site-vegetation-layer-form-input The cluster arrangement materializes individually addressable vegetation placements while preserving the caller's bounded form and spacing inputs.
 * @author Samchon
 */
export const arrangePlantingCluster = (
  cluster: IAutoMoviePlantingCluster,
): IAutoMoviePlantingArrangement => {
  const placements: IAutoMoviePlantingPlacement[] = [];
  const spacing = cluster.minSpacing * cluster.minSpacing;
  // With no spacing rule nothing can ever be refused, so no index is built and
  // no neighbourhood is walked: `dx² + dz² < 0` has no solutions.
  const occupied =
    cluster.minSpacing > 0
      ? new Map<string, { x: number; z: number }[]>()
      : null;
  let rejected = 0;
  for (let slot = 0; slot < cluster.count; ++slot) {
    let placed = false;
    for (let attempt = 0; attempt < cluster.attempts && !placed; ++attempt) {
      const x =
        cluster.anchor.x +
        (2 * seededValue(cluster.seed, slot, attempt, SALT_PLACE_X) - 1) *
          cluster.extent.x;
      const z =
        cluster.anchor.z +
        (2 * seededValue(cluster.seed, slot, attempt, SALT_PLACE_Z) - 1) *
          cluster.extent.z;
      if (
        occupied !== null &&
        crowded(occupied, cluster.minSpacing, spacing, x, z)
      )
        continue;
      placed = true;
      if (occupied !== null) {
        const [cx, cz] = cell(cluster.minSpacing, x, z);
        const key = `${cx},${cz}`;
        const bucket = occupied.get(key);
        if (bucket === undefined) occupied.set(key, [{ x, z }]);
        else bucket.push({ x, z });
      }
      placements.push({
        id: `${cluster.id}#${slot}`,
        slot,
        translation: { x, y: cluster.anchor.y, z },
        rotation: yaw(
          seededValue(cluster.seed, slot, SALT_PLACE_YAW),
          cluster.yawJitter,
        ),
        scale: {
          x: between(
            cluster.scale.min.x,
            cluster.scale.max.x,
            seededValue(cluster.seed, slot, SALT_PLACE_SCALE, 0),
          ),
          y: between(
            cluster.scale.min.y,
            cluster.scale.max.y,
            seededValue(cluster.seed, slot, SALT_PLACE_SCALE, 1),
          ),
          z: between(
            cluster.scale.min.z,
            cluster.scale.max.z,
            seededValue(cluster.seed, slot, SALT_PLACE_SCALE, 2),
          ),
        },
      });
    }
    if (placed === false) ++rejected;
  }
  return {
    cluster: cluster.id,
    domain: cluster.domain,
    placements,
    rejected,
    bounds: extents(placements.map((placement) => placement.translation)),
  };
};

/**
 * The bounded cost a planting recipe, and optionally its cluster, adds to a
 * shot.
 *
 * Nothing here grows a branch: a production is refused for an unaffordable
 * green wall before the first derivation, and the same numbers ride into the
 * compiler's report so a reviewer sees what the planting cost.
 *
 * The worst case is the complete `k`-ary tree of depth `levels`, which is what
 * an unpruned recipe at full growth actually emits.
 *
 * Foliage is counted the same way rather than read off the declared cap. A
 * branch at level `l` is no longer than
 *
 * ```text
 *   Λ(l) = length · lengthRatio^l · (1 + lengthJitter)^(l + 1)
 * ```
 *
 * One jitter draw per generation and each strictly below its own bound, and it
 * bears `⌊density · Λ(l)⌋` blades. The worst case is that count summed over the
 * complete tree from `minLevel` down. Growth and pruning only ever shorten a
 * branch, so the number bounds every state the recipe can be in.
 *
 * Both totals are counted by **walking the declared depth**, so this is only
 * asked of a recipe whose `structure.levels` is already known to be inside
 * {@link PLANTING_MAX_LEVELS}: a record claiming a quadrillion levels would
 * otherwise be walked a quadrillion times by the very report that exists to
 * price it. {@link validatePlantingDomain} refuses such a depth on its own path
 * and only measures once it is in range, which is the order any other caller
 * follows too.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Prices the worst-case branch, leaf, and member work before derivation.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Supplies the bounded-work account of an interior planting.
 * @author Samchon
 */
export const plantingBudget = (props: {
  domain: IAutoMoviePlantingDomain;
  cluster?: IAutoMoviePlantingCluster;
}): IAutoMoviePlantingBudget => {
  const { domain } = props;
  const structure = domain.structure;
  const foliage = domain.foliage;
  const children = structure.children.length;
  const spread = 1 + structure.lengthJitter;
  let worstCaseBranches = 0;
  let worstCaseLeaves = 0;
  let level = 1;
  let reach = structure.length * spread;
  for (let at = 0; at < structure.levels; ++at) {
    worstCaseBranches += level;
    if (foliage !== null && at >= foliage.minLevel)
      worstCaseLeaves += level * Math.floor(foliage.density * reach);
    level *= children;
    reach *= structure.lengthRatio * spread;
  }
  const members = props.cluster === undefined ? 1 : props.cluster.count;
  return {
    domain: domain.id,
    worstCaseBranches,
    worstCaseLeaves,
    maxBranches: domain.budget.maxBranches,
    maxLeaves: domain.budget.maxLeaves,
    members,
    worstCaseBranchInstances: worstCaseBranches * members,
    worstCaseLeafInstances: worstCaseLeaves * members,
  };
};

/**
 * A stable 32-bit FNV-1a digest of one derived planting structure, as lowercase
 * hex.
 *
 * Two structures digest alike only when every coordinate, quaternion component
 * and scale is bit-identical, so it is the compact evidence that a
 * re-derivation or a second machine reproduced the reference plant rather than
 * merely a similar one.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-plant-placement-state Records exact equality of a deterministically derived planting state.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Provides the repeatability receipt for the generated planting structure.
 * @author Samchon
 */
export const plantingStateDigest = (state: IAutoMoviePlantingState): string => {
  const values: number[] = [
    state.stage,
    state.branches.length,
    state.leaves.length,
  ];
  for (const branch of state.branches)
    values.push(
      branch.level,
      branch.start.x,
      branch.start.y,
      branch.start.z,
      branch.end.x,
      branch.end.y,
      branch.end.z,
      branch.radiusStart,
      branch.radiusEnd,
      branch.pruned ? 1 : 0,
    );
  for (const leaf of state.leaves)
    values.push(
      leaf.translation.x,
      leaf.translation.y,
      leaf.translation.z,
      leaf.rotation.x,
      leaf.rotation.y,
      leaf.rotation.z,
      leaf.rotation.w,
      leaf.scale.x,
      leaf.scale.y,
      leaf.scale.z,
    );
  const view = new DataView(new ArrayBuffer(8));
  let hash = 0x811c9dc5;
  for (const value of values) {
    view.setFloat64(0, value, true);
    for (let byte = 0; byte < 8; ++byte) {
      hash = (hash ^ view.getUint8(byte)) >>> 0;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
};

/**
 * The uniform-grid key one ground position falls in.
 *
 * The neighbourhood walk offsets the two integer indices rather than the two
 * coordinates: `floor((x + side)/side)` and `floor(x/side) + 1` are the same
 * rational number and not always the same double, and a neighbourhood that
 * misses a cell is a spacing rule that silently stops holding.
 */
const cell = (side: number, x: number, z: number): [number, number] => [
  Math.floor(x / side),
  Math.floor(z / side),
];

/**
 * Whether an accepted member already stands closer than the minimum spacing.
 *
 * The grid side is the spacing itself, so a member within that distance can
 * only be in the candidate's own cell or one of the eight around it. Walking
 * those nine answers exactly what walking every member would, at a cost that
 * does not grow with the size of the bed.
 */
const crowded = (
  occupied: Map<string, { x: number; z: number }[]>,
  side: number,
  spacing: number,
  x: number,
  z: number,
): boolean => {
  const [cx, cz] = cell(side, x, z);
  for (let dx = -1; dx <= 1; ++dx)
    for (let dz = -1; dz <= 1; ++dz) {
      const bucket = occupied.get(`${cx + dx},${cz + dz}`);
      if (bucket === undefined) continue;
      for (const other of bucket) {
        const ox = other.x - x;
        const oz = other.z - z;
        if (ox * ox + oz * oz < spacing) return true;
      }
    }
  return false;
};

/**
 * Leaves borne by one derived branch, in stable index order.
 *
 * The declared leaf cap is enforced **while** blades are emitted rather than
 * once the whole structure is derived. A density is leaves per metre and is
 * deliberately not capped — a moss is not a wrong plant — so a branch can ask
 * for more blades than the recipe allows, and a cap only checked afterwards
 * would be a cap the machine has to exhaust itself reaching.
 */
const bearLeaves = (props: {
  domain: IAutoMoviePlantingDomain;
  branch: string;
  level: number;
  key: number;
  base: IAutoMovieVector3;
  axis: IAutoMovieVector3;
  length: number;
  leaves: IAutoMoviePlantingLeaf[];
}): void => {
  const foliage = props.domain.foliage;
  if (foliage === null || props.level < foliage.minLevel) return;
  const count = Math.floor(foliage.density * props.length);
  const align = shortestArcFromUp(props.axis);
  for (let index = 0; index < count; ++index) {
    if (props.leaves.length >= props.domain.budget.maxLeaves)
      throw new Error(
        `planting "${props.domain.id}" exceeded its declared cap of ${props.domain.budget.maxLeaves} leaves`,
      );
    const along = ((index + 0.5) / count) * props.length;
    const roll = yaw(
      seededValue(props.domain.seed, props.key, SALT_LEAF_ROLL, index),
      foliage.rollJitter,
    );
    const factor = jitter(
      props.domain.seed,
      props.key,
      SALT_LEAF_SCALE,
      foliage.scaleJitter,
      index,
    );
    props.leaves.push({
      id: `${props.branch}:leaf#${index}`,
      branch: props.branch,
      translation: {
        x: props.base.x + props.axis.x * along,
        y: props.base.y + props.axis.y * along,
        z: props.base.z + props.axis.z * along,
      },
      // Roll first in the leaf's own frame, then align that frame's `+y` to the
      // branch: composing the other way would spin the blade about world `+y`
      // and a drooping branch would carry a fan of leaves in the wrong plane.
      rotation: multiply(align, roll),
      scale: {
        x: foliage.size.x * factor,
        y: foliage.size.y * factor,
        z: foliage.size.z * factor,
      },
    });
  }
};

/** The world axis one child grows along. */
const childAxis = (
  domain: IAutoMoviePlantingDomain,
  parent: IAutoMovieVector3,
  local: IAutoMovieVector3,
  key: number,
): IAutoMovieVector3 => {
  const frame = perpendicularFrame(parent);
  const directed = unitOr(
    {
      x: frame.u.x * local.x + parent.x * local.y + frame.v.x * local.z,
      y: frame.u.y * local.x + parent.y * local.y + frame.v.y * local.z,
      z: frame.u.z * local.x + parent.z * local.y + frame.v.z * local.z,
    },
    parent,
  );
  const bias = domain.structure.gravitropism;
  const weight = bias < 0 ? -bias : bias;
  const pull = bias > 0 ? -1 : 1;
  const bent = unitOr(
    {
      x: directed.x * (1 - weight),
      y: directed.y * (1 - weight) + pull * weight,
      z: directed.z * (1 - weight),
    },
    parent,
  );
  const spread = domain.structure.directionJitter;
  return unitOr(
    {
      x:
        bent.x +
        spread * (2 * seededValue(domain.seed, key, SALT_DIRECTION, 0) - 1),
      y:
        bent.y +
        spread * (2 * seededValue(domain.seed, key, SALT_DIRECTION, 1) - 1),
      z:
        bent.z +
        spread * (2 * seededValue(domain.seed, key, SALT_DIRECTION, 2) - 1),
    },
    bent,
  );
};

/**
 * A deterministic orthonormal pair perpendicular to one unit axis.
 *
 * Duff et al., "Building an Orthonormal Basis, Revisited" (JCGT 2017). The sign
 * trick is what keeps `sign + axis.z` away from zero for every unit axis, so
 * the frame is continuous and no direction needs a special case.
 */
const perpendicularFrame = (
  axis: IAutoMovieVector3,
): { u: IAutoMovieVector3; v: IAutoMovieVector3 } => {
  const sign = axis.z >= 0 ? 1 : -1;
  const a = -1 / (sign + axis.z);
  const b = axis.x * axis.y * a;
  return {
    u: {
      x: 1 + sign * axis.x * axis.x * a,
      y: sign * b,
      z: -sign * axis.x,
    },
    v: { x: b, y: sign + axis.y * axis.y * a, z: -axis.y },
  };
};

/** The shortest-arc rotation carrying `+y` onto one unit direction. */
const shortestArcFromUp = (
  direction: IAutoMovieVector3,
): IAutoMovieQuaternion => {
  const x = direction.z;
  const z = -direction.x;
  const w = 1 + direction.y;
  const length = Math.sqrt(x * x + z * z + w * w);
  // Exactly antiparallel: every axis perpendicular to `y` is a shortest arc, so
  // the choice is stated instead of being whichever one a normalization of zero
  // happened to produce.
  if (length === 0) return { x: 1, y: 0, z: 0, w: 0 };
  return { x: x / length, y: 0, z: z / length, w: w / length };
};

/**
 * A seeded turn about `+y`, blended toward identity by `amount`.
 *
 * The half-angle `φ` is drawn straight from the rational parameterization of
 * the circle — `(cos φ, sin φ) = ((1 − t²)/(1 + t²), 2t/(1 + t²))` on the first
 * quadrant, lifted to the second by the quarter-turn swap — so a full turn is
 * covered without a single call to a transcendental function and without a
 * rejection loop whose failure arm no test could ever reach. The distribution
 * is uniform in the half-tangent rather than in the angle, which is a stated
 * property of the jitter, not an approximation of a uniform one.
 *
 * Blending is a normalized quaternion interpolation toward identity. `amount`
 * is therefore a fraction of a rotation rather than a scaled angle, which is
 * what keeps the whole derivation free of trigonometry.
 */
const yaw = (sample: number, amount: number): IAutoMovieQuaternion => {
  const doubled = 2 * sample;
  const half = Math.floor(doubled);
  const t = doubled - half;
  const denominator = 1 + t * t;
  const cosine = (1 - t * t) / denominator;
  const sine = (2 * t) / denominator;
  // `half === 1` lifts the first quadrant into the second by the quarter-turn
  // rotation `(c, s) -> (-s, c)`, so `φ` sweeps the whole half-turn that a full
  // turn of the branch corresponds to.
  const w = half === 0 ? cosine : -sine;
  const y = half === 0 ? sine : cosine;
  const blended = {
    x: 0,
    y: amount * (w < 0 ? -y : y),
    z: 0,
    w: 1 - amount + amount * (w < 0 ? -w : w),
  };
  const length = Math.sqrt(blended.y * blended.y + blended.w * blended.w);
  return { x: 0, y: blended.y / length, z: 0, w: blended.w / length };
};

/** Hamilton product in glTF `(x, y, z, w)` order. */
const multiply = (
  a: IAutoMovieQuaternion,
  b: IAutoMovieQuaternion,
): IAutoMovieQuaternion => ({
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
});

/** One symmetric multiplicative jitter in `[1 − amount, 1 + amount)`. */
const jitter = (
  seed: number,
  key: number,
  salt: number,
  amount: number,
  index = 0,
): number => 1 + amount * (2 * seededValue(seed, key, salt, index) - 1);

/** One sample mapped into `[min, max]`. */
const between = (min: number, max: number, sample: number): number =>
  min + (max - min) * sample;

/** A unit vector, or the stated fallback when the input has no length. */
const unitOr = (
  value: IAutoMovieVector3,
  fallback: IAutoMovieVector3,
): IAutoMovieVector3 => {
  const length = Math.sqrt(
    value.x * value.x + value.y * value.y + value.z * value.z,
  );
  if (length === 0) return fallback;
  return { x: value.x / length, y: value.y / length, z: value.z / length };
};

/** Whether one point lies inside the pruning envelope. */
const inside = (
  envelope: IAutoMoviePruningEnvelope,
  point: IAutoMovieVector3,
): boolean => {
  if (envelope.kind === "none") return true;
  if (envelope.kind === "box")
    return (
      point.x >= envelope.min.x &&
      point.x <= envelope.max.x &&
      point.y >= envelope.min.y &&
      point.y <= envelope.max.y &&
      point.z >= envelope.min.z &&
      point.z <= envelope.max.z
    );
  const dx = point.x - envelope.center.x;
  const dy = point.y - envelope.center.y;
  const dz = point.z - envelope.center.z;
  return dx * dx + dy * dy + dz * dz <= envelope.radius * envelope.radius;
};

/**
 * The distance at which a segment leaves the envelope, or `null` when it never
 * does.
 *
 * The base is known to be inside, so a box exit is the nearest slab crossing
 * ahead of it and a sphere exit is the positive root of the quadratic. Both are
 * analytic: a sampled cut would move as the sampling changed, and a hedge whose
 * clipped face depends on a step count is not a clipped hedge.
 */
const clip = (
  envelope: IAutoMoviePruningEnvelope,
  base: IAutoMovieVector3,
  axis: IAutoMovieVector3,
  length: number,
): number | null => {
  if (envelope.kind === "none") return null;
  if (envelope.kind === "box") {
    let exit = Infinity;
    const low = [envelope.min.x, envelope.min.y, envelope.min.z];
    const high = [envelope.max.x, envelope.max.y, envelope.max.z];
    const from = [base.x, base.y, base.z];
    const direction = [axis.x, axis.y, axis.z];
    for (let at = 0; at < 3; ++at) {
      if (direction[at] === 0) continue;
      const bound = direction[at] > 0 ? high[at] : low[at];
      const distance = (bound - from[at]) / direction[at];
      if (distance < exit) exit = distance;
    }
    return exit < length ? exit : null;
  }
  const ox = base.x - envelope.center.x;
  const oy = base.y - envelope.center.y;
  const oz = base.z - envelope.center.z;
  const b = ox * axis.x + oy * axis.y + oz * axis.z;
  const c = ox * ox + oy * oy + oz * oz - envelope.radius * envelope.radius;
  const exit = -b + Math.sqrt(b * b - c);
  return exit < length ? exit : null;
};

/** The world box a point list occupies, or `null` for an empty list. */
const extents = (points: IAutoMovieVector3[]): IAutoMovieSoftBounds | null => {
  if (points.length === 0) return null;
  const low = { x: Infinity, y: Infinity, z: Infinity };
  const high = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const point of points) {
    low.x = Math.min(low.x, point.x);
    low.y = Math.min(low.y, point.y);
    low.z = Math.min(low.z, point.z);
    high.x = Math.max(high.x, point.x);
    high.y = Math.max(high.y, point.y);
    high.z = Math.max(high.z, point.z);
  }
  return { min: low, max: high };
};
