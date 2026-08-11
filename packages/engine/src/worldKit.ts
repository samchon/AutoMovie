import {
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieSceneNode,
  IAutoMovieVector3,
  IAutoMovieWorldLandmark,
  IAutoMovieWorldRoute,
  IAutoMovieWorldSurface,
} from "@automovie/interface";

import { productionRuntimeModelId } from "./productionIdentity";
import { surfaceHeightAt } from "./space/surfaces";

/**
 * One generated visible wall/building block and its support footprint.
 *
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Keeps an authored primitive recipe, its staged node, and occupied bounds under the project's block identity.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Makes the caller's block semantics and geometry explicit data passed into later compilation stages.
 */
export interface IAutoMovieWorldBlock {
  /**
   * Stable block identity.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the project's chosen block identity across its recipe, node, bounds, and validation errors.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Requires block identity as authored input instead of deriving it from position or array order.
   */
  id: string;
  /**
   * Block semantic.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains whether the project authored the primitive as a wall or building without inferring semantics from its dimensions.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Carries the caller-selected block role as an explicit output field for downstream decisions.
   */
  kind: "wall" | "building";
  /**
   * Primitive recipe registered with production design.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the project's archetype, dimensions, palette, and representation choices as its model recipe.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Emits the complete primitive recipe that the compiler consumes rather than hiding construction parameters in the helper.
   */
  recipe: IAutoMovieModelRecipe;
  /**
   * Static scene node using the compiler-owned runtime model id.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Retains the project's grounded placement as a scene node bound to the compiler-owned runtime model identity.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Exposes the derived translation and runtime-model reference as plain output consumed by shot construction.
   */
  node: IAutoMovieSceneNode;
  /**
   * Exact axis-aligned occupied world volume.
   *
   * @evidence requirements/product/capability-and-content.md#product-project-owned-content Carries the exact occupied volume derived from the project's base and size beside the visible block.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Publishes collision and support bounds as explicit output so validators need not reconstruct them from rendering data.
   */
  bounds: {
    min: IAutoMovieVector3;
    max: IAutoMovieVector3;
  };
}

/**
 * Build one box-proxy wall or building from a grounded base and size.
 *
 * The emitted recipe names an archetype the production must have registered. It
 * defaults to the shipped `primitive-prop` builder and its `box` shape, because
 * that is what this helper's parameters describe; a production whose catalogue
 * spells the same static primitive differently passes its own id.
 *
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Converts the project's chosen identity, role, primitive dimensions, palette, and placement into one source-owned block record.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Validates every authored input and emits the recipe, node, and bounds needed by downstream compilation.
 */
export const worldBlock = (input: {
  id: string;
  kind: IAutoMovieWorldBlock["kind"];
  base: IAutoMovieVector3;
  size: IAutoMovieVector3;
  color: string;
  archetype?: string;
}): IAutoMovieWorldBlock => {
  assertText(input.id, "World block id");
  for (const [name, value] of Object.entries(input.size))
    if (Number.isFinite(value) === false || value <= 0)
      throw new Error(
        `World block "${input.id}" size.${name} must be positive.`,
      );
  assertVector(input.base, `World block "${input.id}" base`);
  if (/^#[0-9a-f]{6}$/i.test(input.color) === false)
    throw new Error(`World block "${input.id}" color must be #RRGGBB.`);
  const recipe: IAutoMovieModelRecipe = {
    id: input.id,
    role: "set",
    archetype: input.archetype ?? "primitive-prop",
    parameters: {
      shape: "box",
      width: input.size.x,
      height: input.size.y,
      depth: input.size.z,
    },
    palette: { structure: input.color },
    lod: [{ tier: "near", maxDistance: null, recipe: input.id }],
    capabilities: [],
    attachments: [],
  };
  return {
    id: input.id,
    kind: input.kind,
    recipe,
    node: {
      id: input.id,
      model: productionRuntimeModelId(input.id),
      transform: {
        translation: {
          x: input.base.x,
          y: input.base.y + input.size.y / 2,
          z: input.base.z,
        },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      motion: null,
      pose: null,
    },
    bounds: {
      min: {
        x: input.base.x - input.size.x / 2,
        y: input.base.y,
        z: input.base.z - input.size.z / 2,
      },
      max: {
        x: input.base.x + input.size.x / 2,
        y: input.base.y + input.size.y,
        z: input.base.z + input.size.z / 2,
      },
    },
  };
};

/**
 * Build one flat terrain primitive from an explicit world-XZ footprint.
 *
 * @evidence requirements/map/terrain-and-landforms.md#map-elevation-slope Preserves an authored XZ footprint, constant elevation, and traversal state as one terrain surface.
 * @evidence requirements/map/movement-and-visibility.md#map-traversable-surfaces `worldTerrain` preserves the caller's explicit walkable state on the same stable terrain identity and footprint used by world queries.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-elevation-slope-surface-input Emits a constant-height surface whose footprint and elevation remain explicit deterministic inputs.
 * @evidence specifications/world-and-site/traversal-and-visibility.md#world-site-traversable-surface-input The emitted surface carries its exact world footprint, height, and traversability flag without inferring a route or cost model.
 */
export const worldTerrain = (input: {
  id: string;
  polygon: IAutoMovieWorldSurface["polygon"];
  height: number;
  walkable: boolean;
}): IAutoMovieWorldSurface => ({
  id: input.id,
  polygon: structuredClone(input.polygon),
  height: { kind: "constant", value: input.height },
  walkable: input.walkable,
});

/**
 * Build one rectangular ramp surface from a centerline and explicit rise.
 *
 * @evidence requirements/map/terrain-and-landforms.md#map-elevation-slope Derives the ramp's footprint and planar slope from its authored centerline, width, base elevation, and rise.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-elevation-slope-surface-input Produces one explicit plane-height rule after rejecting degenerate or non-finite surface inputs.
 */
export const worldRamp = (input: {
  id: string;
  from: { x: number; z: number };
  to: { x: number; z: number };
  width: number;
  baseHeight: number;
  rise: number;
  walkable: boolean;
}): IAutoMovieWorldSurface => {
  assertText(input.id, "World ramp id");
  const dx = input.to.x - input.from.x;
  const dz = input.to.z - input.from.z;
  const lengthSquared = dx * dx + dz * dz;
  if (
    Number.isFinite(input.width) === false ||
    input.width <= 0 ||
    Number.isFinite(input.baseHeight) === false ||
    Number.isFinite(input.rise) === false ||
    Number.isFinite(lengthSquared) === false ||
    lengthSquared <= 0
  )
    throw new Error(
      `World ramp "${input.id}" requires finite distinct endpoints, positive width, and finite baseHeight/rise.`,
    );
  const length = Math.sqrt(lengthSquared);
  const offset = {
    x: (-dz / length) * (input.width / 2),
    z: (dx / length) * (input.width / 2),
  };
  return {
    id: input.id,
    polygon: [
      { x: input.from.x + offset.x, z: input.from.z + offset.z },
      { x: input.to.x + offset.x, z: input.to.z + offset.z },
      { x: input.to.x - offset.x, z: input.to.z - offset.z },
      { x: input.from.x - offset.x, z: input.from.z - offset.z },
    ],
    height: {
      kind: "plane",
      originHeight:
        input.baseHeight -
        (input.rise * (dx * input.from.x + dz * input.from.z)) / lengthSquared,
      slopeX: (input.rise * dx) / lengthSquared,
      slopeZ: (input.rise * dz) / lengthSquared,
    },
    walkable: input.walkable,
  };
};

/**
 * Build one heightfield terrain surface by sampling a height function.
 *
 * The relief a production wants is almost always a rule — a slope that eases
 * off, a terrace, a bank falling to a river — and transcribing that rule into a
 * flat array by hand is where a hill acquires a step nobody meant. The function
 * is evaluated once per lattice point, in row-major order, and only its results
 * are kept: the compiled design carries numbers, so nothing at render time
 * depends on the function still existing or still answering the same way.
 *
 * That makes determinism the caller's to keep for exactly one thing: `height`
 * must be a pure function of the point it is given. A sampler that reads a
 * clock, a counter or unseeded randomness bakes one machine's terrain into the
 * design, which is the one way this can produce different frames elsewhere.
 *
 * @evidence requirements/map/terrain-and-landforms.md#map-elevation-slope Samples an authored elevation rule on a declared XZ lattice and stores the resulting terrain heights.
 * @evidence requirements/map/terrain-and-landforms.md#map-terrain-resolution-uncertainty `worldHeightfield` makes sample origin, spacing, row and column counts, and every finite height explicit so callers can retain the terrain's actual resolution.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-elevation-slope-surface-input Fixes footprint, origin, spacing, sample order, and finite elevations in the emitted heightfield record.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-terrain-resolution-gap The heightfield record exposes the finite lattice resolution rather than presenting unsampled terrain as continuous measured detail.
 */
export const worldHeightfield = (input: {
  id: string;
  polygon: IAutoMovieWorldSurface["polygon"];
  /** World XZ of sample column and row zero. */
  origin: { x: number; z: number };
  /** Column and row pitch in meters, both strictly above zero. */
  spacing: { x: number; z: number };
  /** Sample columns along +X; at least two. */
  columns: number;
  /** Sample rows along +Z; at least two. */
  rows: number;
  /** Surface height in meters at one lattice point. */
  height: (point: { x: number; z: number }) => number;
  walkable: boolean;
}): IAutoMovieWorldSurface => {
  assertText(input.id, "World heightfield id");
  if (
    Number.isFinite(input.spacing.x) === false ||
    input.spacing.x <= 0 ||
    Number.isFinite(input.spacing.z) === false ||
    input.spacing.z <= 0 ||
    Number.isFinite(input.origin.x) === false ||
    Number.isFinite(input.origin.z) === false
  )
    throw new Error(
      `World heightfield "${input.id}" requires a finite origin and positive spacing.`,
    );
  if (
    Number.isSafeInteger(input.columns) === false ||
    Number.isSafeInteger(input.rows) === false ||
    input.columns < 2 ||
    input.rows < 2
  )
    throw new Error(
      `World heightfield "${input.id}" requires at least two sample columns and rows.`,
    );
  const samples: number[] = [];
  for (let row = 0; row < input.rows; ++row)
    for (let column = 0; column < input.columns; ++column) {
      const height = input.height({
        x: input.origin.x + column * input.spacing.x,
        z: input.origin.z + row * input.spacing.z,
      });
      if (Number.isFinite(height) === false)
        throw new Error(
          `World heightfield "${input.id}" sampled a non-finite height at column ${column}, row ${row}.`,
        );
      samples.push(height);
    }
  return {
    id: input.id,
    polygon: structuredClone(input.polygon),
    height: {
      kind: "heightfield",
      originX: input.origin.x,
      originZ: input.origin.z,
      spacingX: input.spacing.x,
      spacingZ: input.spacing.z,
      columns: input.columns,
      rows: input.rows,
      samples,
    },
    walkable: input.walkable,
  };
};

/**
 * Build one deterministic rectangular instance placement.
 *
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the project's selected prototype, bounds, variation, and rectangular layout as one compact instance-set design.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Returns the caller's grid parameters as plain cloned output without inventing or expanding content.
 */
export const worldGrid = (
  base: Omit<IAutoMovieInstanceSetDesign, "layout">,
  layout: Extract<IAutoMovieInstanceSetDesign["layout"], { kind: "grid" }>,
): IAutoMovieInstanceSetDesign => ({
  ...structuredClone(base),
  layout: structuredClone(layout),
});

/**
 * Build one deterministic disk-scatter instance placement.
 *
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the project's selected prototype, variation, and disk-scatter rule as one compact instance-set design.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Returns the caller's scatter extent, count, seed, and spacing inputs without silently choosing population content.
 */
export const worldScatter = (
  base: Omit<IAutoMovieInstanceSetDesign, "layout">,
  layout: Extract<IAutoMovieInstanceSetDesign["layout"], { kind: "scatter" }>,
): IAutoMovieInstanceSetDesign => ({
  ...structuredClone(base),
  layout: structuredClone(layout),
});

/**
 * Build one deterministic route-following instance placement.
 *
 * @evidence requirements/product/capability-and-content.md#product-project-owned-content Preserves the project's selected prototype and route-following placement rule as one compact instance-set design.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-capability-input-output Returns the explicit route, spacing, offset, and variation inputs without resolving them through hidden defaults.
 */
export const worldAlongRoute = (
  base: Omit<IAutoMovieInstanceSetDesign, "layout">,
  layout: Extract<
    IAutoMovieInstanceSetDesign["layout"],
    { kind: "along-route" }
  >,
): IAutoMovieInstanceSetDesign => ({
  ...structuredClone(base),
  layout: structuredClone(layout),
});

/**
 * Reject material world-layout contradictions before shot construction.
 *
 * Blocks may touch but not overlap; every base must sit on a declared surface;
 * routes must clear block footprints; every landmark must lie on a walkable
 * surface or within its declared radius of a route.
 *
 * @evidence requirements/map/deliverables-and-validation.md#map-environment-relation-validation Rejects overlapping or unsupported blocks, obstructed routes, and landmarks unreachable from declared terrain.
 * @evidence requirements/map/terrain-and-landforms.md#map-terrain-contact-boundary `assertWorldPlacements` rejects a block whose base does not contact the selected declared terrain height and rejects routes whose footprints intersect placed blocks.
 * @evidence requirements/map/deliverables-and-validation.md#map-geometry-topology-validation The validator checks block overlap, terrain support, route clearance, and landmark reachability on the canonical world geometry before shot construction.
 * @evidence specifications/world-and-site/delivery-and-validation.md#world-site-environment-relation-validation Checks support, contact, clearance, and traversal relationships against the same canonical world records.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-terrain-modification-contact The placement gate compares each block base with the actual supporting surface height and preserves touching boundaries as valid contact.
 * @evidence specifications/world-and-site/delivery-and-validation.md#world-site-geometry-topology-validation The gate returns only after all declared placement, support, clearance, and reachability relations are geometrically consistent.
 */
export const assertWorldPlacements = (input: {
  blocks: readonly IAutoMovieWorldBlock[];
  surfaces: readonly IAutoMovieWorldSurface[];
  routes: readonly IAutoMovieWorldRoute[];
  landmarks: readonly IAutoMovieWorldLandmark[];
}): void => {
  for (let left = 0; left < input.blocks.length; ++left)
    for (let right = left + 1; right < input.blocks.length; ++right)
      if (overlaps(input.blocks[left]!, input.blocks[right]!))
        throw new Error(
          `World blocks "${input.blocks[left]!.id}" and "${input.blocks[right]!.id}" overlap.`,
        );
  for (const block of input.blocks) {
    if (
      input.surfaces.some((surface) => surfaceSupportsBlock(surface, block)) ===
      false
    )
      throw new Error(
        `World block "${block.id}" floats or lacks a supporting surface at its base.`,
      );
  }
  for (const route of input.routes)
    for (let index = 1; index < route.waypoints.length; ++index)
      for (const block of input.blocks)
        if (
          segmentIntersectsBounds(
            route.waypoints[index - 1]!,
            route.waypoints[index]!,
            block.bounds,
            route.allowedFormationWidth / 2,
          )
        )
          throw new Error(
            `World route "${route.id}" is blocked by "${block.id}".`,
          );
  for (const landmark of input.landmarks) {
    const onWalkable = input.surfaces.some(
      (surface) =>
        surface.walkable && insidePolygon(landmark.position, surface.polygon),
    );
    const byRoute = input.routes.some((route) =>
      route.waypoints
        .slice(1)
        .some(
          (point, index) =>
            pointSegmentDistance(
              landmark.position,
              route.waypoints[index]!,
              point,
            ) <=
            landmark.radius + route.allowedFormationWidth / 2,
        ),
    );
    if (onWalkable === false && byRoute === false)
      throw new Error(
        `World landmark "${landmark.id}" is unreachable from walkable terrain and declared routes.`,
      );
  }
};

/**
 * Evaluate one production-world height rule at an XZ point.
 *
 * The footprint is not consulted: this answers what the rule says, and
 * {@link worldGroundSurface} answers where the rule applies. A `heightfield`
 * clamps to its edge samples outside its own lattice, so the answer stays a
 * finite number wherever it is asked.
 *
 * The world spelling of {@link surfaceHeightAt}, which is where the arithmetic
 * lives. A scene's standable patch carries the same {@link IAutoMovieHeightRule}
 * and is read by that same function, so terrain a crowd is placed on and ground
 * a performer plants a foot on cannot answer differently.
 *
 * @evidence requirements/map/terrain-and-landforms.md#map-elevation-slope Evaluates constant, planar, and sampled terrain elevations through the shared surface-height arithmetic.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-elevation-slope-surface-input Derives an XZ point's elevation from the exact surface representation carried in canonical state.
 */
export const worldSurfaceHeight = (
  surface: IAutoMovieWorldSurface,
  point: { x: number; z: number },
): number => surfaceHeightAt(surface, point.x, point.z);

/**
 * The world terrain under an XZ point, or `null` where the world has none.
 *
 * The first declared surface containing the point wins, which is the answer the
 * ground oracle already reported and therefore the one an author has been
 * composing against: a terraced square states its steps in the order it wants
 * them read. A point exactly on a footprint edge is on that surface, because
 * the edge of a floor is still floor and a strict reading would drop the
 * outermost rank of a unit sized to its own ground.
 *
 * The height that goes with it is {@link worldSurfaceHeight} of the same record.
 * Both answers come from here so a placement, a gate and an oracle cannot each
 * pick a different surface.
 *
 * @evidence requirements/map/terrain-and-landforms.md#map-elevation-slope Selects the authored terrain surface whose footprint contains the queried XZ point, including its boundary.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-elevation-slope-surface-input Resolves ground membership from ordered explicit footprints before any elevation is sampled.
 */
export const worldGroundSurface = (
  surfaces: readonly IAutoMovieWorldSurface[],
  point: { x: number; z: number },
): IAutoMovieWorldSurface | null =>
  surfaces.find((surface) => insideOrOnPolygon(point, surface.polygon)) ?? null;

/**
 * Height of the world terrain under an XZ point, or `null` over nothing.
 *
 * @evidence requirements/map/terrain-and-landforms.md#map-elevation-slope Returns the declared terrain elevation below an XZ point while preserving the absence of ground as `null`.
 * @evidence requirements/map/terrain-and-landforms.md#map-terrain-gap `worldGroundHeight` returns `null` when no declared surface contains the point, keeping missing terrain distinct from an invented zero elevation.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-elevation-slope-surface-input Joins footprint selection and the shared height rule so placement and terrain queries read one surface record.
 * @evidence specifications/world-and-site/terrain-ground-and-geology.md#world-site-terrain-resolution-gap The ground query exposes an explicit gap outside every declared footprint instead of extrapolating the nearest heightfield.
 */
export const worldGroundHeight = (
  surfaces: readonly IAutoMovieWorldSurface[],
  point: { x: number; z: number },
): number | null => {
  const surface = worldGroundSurface(surfaces, point);
  return surface === null ? null : worldSurfaceHeight(surface, point);
};

const overlaps = (
  left: IAutoMovieWorldBlock,
  right: IAutoMovieWorldBlock,
): boolean =>
  left.bounds.min.x < right.bounds.max.x &&
  left.bounds.max.x > right.bounds.min.x &&
  left.bounds.min.y < right.bounds.max.y &&
  left.bounds.max.y > right.bounds.min.y &&
  left.bounds.min.z < right.bounds.max.z &&
  left.bounds.max.z > right.bounds.min.z;

const insidePolygon = (
  point: { x: number; z: number },
  polygon: IAutoMovieWorldSurface["polygon"],
): boolean => {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = polygon[index]!;
    const prior = polygon[previous]!;
    if (
      current.z > point.z !== prior.z > point.z &&
      point.x <
        ((prior.x - current.x) * (point.z - current.z)) /
          (prior.z - current.z) +
          current.x
    )
      inside = !inside;
  }
  return inside;
};

const surfaceSupportsBlock = (
  surface: IAutoMovieWorldSurface,
  block: IAutoMovieWorldBlock,
): boolean => {
  const footprint = [
    { x: block.bounds.min.x, z: block.bounds.min.z },
    { x: block.bounds.max.x, z: block.bounds.min.z },
    { x: block.bounds.max.x, z: block.bounds.max.z },
    { x: block.bounds.min.x, z: block.bounds.max.z },
  ];
  if (
    footprint.some(
      (point) =>
        insideOrOnPolygon(point, surface.polygon) === false ||
        Math.abs(worldSurfaceHeight(surface, point) - block.bounds.min.y) >
          1e-6,
    )
  )
    return false;

  // Four contained corners are insufficient for a concave surface whose notch
  // cuts through the block. A simple polygon has no holes, so a notch must
  // either put one of its vertices inside the rectangle or properly cross a
  // footprint edge.
  if (
    surface.polygon.some(
      (point) =>
        point.x > block.bounds.min.x &&
        point.x < block.bounds.max.x &&
        point.z > block.bounds.min.z &&
        point.z < block.bounds.max.z,
    )
  )
    return false;
  for (let index = 0; index < footprint.length; ++index) {
    const blockFrom = footprint[index]!;
    const blockTo = footprint[(index + 1) % footprint.length]!;
    for (
      let surfaceIndex = 0;
      surfaceIndex < surface.polygon.length;
      ++surfaceIndex
    )
      if (
        segmentsProperlyIntersect(
          blockFrom,
          blockTo,
          surface.polygon[surfaceIndex]!,
          surface.polygon[(surfaceIndex + 1) % surface.polygon.length]!,
        )
      )
        return false;
  }
  return true;
};

const insideOrOnPolygon = (
  point: { x: number; z: number },
  polygon: IAutoMovieWorldSurface["polygon"],
): boolean =>
  polygon.some(
    (current, index) =>
      pointSegmentDistance(
        point,
        current,
        polygon[(index + 1) % polygon.length]!,
      ) <= 1e-9,
  ) || insidePolygon(point, polygon);

const segmentsProperlyIntersect = (
  leftFrom: { x: number; z: number },
  leftTo: { x: number; z: number },
  rightFrom: { x: number; z: number },
  rightTo: { x: number; z: number },
): boolean => {
  const orient = (
    origin: { x: number; z: number },
    first: { x: number; z: number },
    second: { x: number; z: number },
  ): number =>
    (first.x - origin.x) * (second.z - origin.z) -
    (first.z - origin.z) * (second.x - origin.x);
  const leftA = orient(leftFrom, leftTo, rightFrom);
  const leftB = orient(leftFrom, leftTo, rightTo);
  const rightA = orient(rightFrom, rightTo, leftFrom);
  const rightB = orient(rightFrom, rightTo, leftTo);
  return leftA * leftB < -Number.EPSILON && rightA * rightB < -Number.EPSILON;
};

const segmentIntersectsBounds = (
  from: { x: number; z: number },
  to: { x: number; z: number },
  bounds: IAutoMovieWorldBlock["bounds"],
  padding: number,
): boolean => {
  let minimum = 0;
  let maximum = 1;
  for (const axis of ["x", "z"] as const) {
    const delta = to[axis] - from[axis];
    const low = bounds.min[axis] - padding;
    const high = bounds.max[axis] + padding;
    if (Math.abs(delta) <= Number.EPSILON) {
      if (from[axis] < low || from[axis] > high) return false;
      continue;
    }
    const first = (low - from[axis]) / delta;
    const second = (high - from[axis]) / delta;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return false;
  }
  return true;
};

const pointSegmentDistance = (
  point: { x: number; z: number },
  from: { x: number; z: number },
  to: { x: number; z: number },
): number => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared,
          ),
        );
  return Math.hypot(
    point.x - (from.x + dx * ratio),
    point.z - (from.z + dz * ratio),
  );
};

const assertText = (value: string, field: string): void => {
  if (value.trim().length === 0)
    throw new Error(`${field} must contain non-whitespace text.`);
};

const assertVector = (value: IAutoMovieVector3, field: string): void => {
  if ([value.x, value.y, value.z].every(Number.isFinite) === false)
    throw new Error(`${field} must be finite.`);
};
