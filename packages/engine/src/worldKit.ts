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

/** One generated visible wall/building block and its support footprint. */
export interface IAutoMovieWorldBlock {
  /** Stable block identity. */
  id: string;
  /** Block semantic. */
  kind: "wall" | "building";
  /** Primitive recipe registered with production design. */
  recipe: IAutoMovieModelRecipe;
  /** Static scene node using the compiler-owned runtime model id. */
  node: IAutoMovieSceneNode;
  /** Exact axis-aligned occupied world volume. */
  bounds: {
    min: IAutoMovieVector3;
    max: IAutoMovieVector3;
  };
}

/** Build one box-proxy wall or building from a grounded base and size. */
export const worldBlock = (input: {
  id: string;
  kind: IAutoMovieWorldBlock["kind"];
  base: IAutoMovieVector3;
  size: IAutoMovieVector3;
  color: string;
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
    archetype: "primitive-prop",
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

/** Build one flat terrain primitive from an explicit world-XZ footprint. */
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

/** Build one rectangular ramp surface from a centerline and explicit rise. */
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

/** Build one deterministic rectangular instance placement. */
export const worldGrid = (
  base: Omit<IAutoMovieInstanceSetDesign, "layout">,
  layout: Extract<IAutoMovieInstanceSetDesign["layout"], { kind: "grid" }>,
): IAutoMovieInstanceSetDesign => ({
  ...structuredClone(base),
  layout: structuredClone(layout),
});

/** Build one deterministic disk-scatter instance placement. */
export const worldScatter = (
  base: Omit<IAutoMovieInstanceSetDesign, "layout">,
  layout: Extract<IAutoMovieInstanceSetDesign["layout"], { kind: "scatter" }>,
): IAutoMovieInstanceSetDesign => ({
  ...structuredClone(base),
  layout: structuredClone(layout),
});

/** Build one deterministic route-following instance placement. */
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

/** Evaluate one production-world height rule at an XZ point. */
export const worldSurfaceHeight = (
  surface: IAutoMovieWorldSurface,
  point: { x: number; z: number },
): number =>
  surface.height.kind === "constant"
    ? surface.height.value
    : surface.height.originHeight +
      surface.height.slopeX * point.x +
      surface.height.slopeZ * point.z;

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
