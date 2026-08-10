import { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import { convexHull2D } from "../math/hull";
import { tessellateToMesh } from "./tessellate";

/** One point of a code-authored 2D construction profile. */
export interface IAutoMovieProfilePoint {
  /** Horizontal profile coordinate in metres. */
  x: number;
  /** Vertical profile coordinate in metres. */
  y: number;
}

/** One axis-aligned rectangular void in a wall's local XY face. */
export interface IAutoMovieWallOpening {
  /** Stable opening identity used in diagnostics. */
  id: string;
  /** Left edge measured from the wall's left edge. */
  x: number;
  /** Bottom edge measured from the wall's bottom edge. */
  y: number;
  /** Positive opening width. */
  width: number;
  /** Positive opening height. */
  height: number;
}

/** Extrude a convex XY profile along local Z into a closed triangle mesh. */
export const extrudeAutoMovieProfile = (props: {
  profile: readonly IAutoMovieProfilePoint[];
  depth: number;
}): IAutoMovieMesh => {
  positive(props.depth, "extrusion depth");
  const profile = profileHull(props.profile);
  const half = props.depth / 2;
  const positions = profile.flatMap((point) => [point.x, point.y, half]);
  positions.push(...profile.flatMap((point) => [point.x, point.y, -half]));
  const count = profile.length;
  const indices: number[] = [];
  for (let index = 1; index + 1 < count; ++index) {
    indices.push(0, index, index + 1);
    indices.push(count, count + index + 1, count + index);
  }
  for (let index = 0; index < count; ++index) {
    const next = (index + 1) % count;
    indices.push(index, count + index, next);
    indices.push(next, count + index, count + next);
  }
  return meshOf(positions, indices);
};

/** Revolve a radius/height profile around local Y into a closed surface. */
export const revolveAutoMovieProfile = (props: {
  profile: readonly IAutoMovieProfilePoint[];
  segments: number;
}): IAutoMovieMesh => {
  if (props.profile.length < 2)
    throw new Error("revolve profile needs at least two points");
  segments(props.segments, "revolve segments");
  props.profile.forEach((point, index) => {
    finitePoint(point, `revolve profile[${index}]`);
    if (point.x < 0)
      throw new Error(`revolve profile[${index}] radius must be >= 0`);
  });
  const positions: number[] = [];
  for (let segment = 0; segment <= props.segments; ++segment) {
    const angle = (segment / props.segments) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (const point of props.profile)
      positions.push(point.x * cosine, point.y, point.x * sine);
  }
  const count = props.profile.length;
  const indices: number[] = [];
  for (let segment = 0; segment < props.segments; ++segment)
    for (let point = 0; point + 1 < count; ++point) {
      const current = segment * count + point;
      const next = current + count;
      indices.push(current, current + 1, next);
      indices.push(current + 1, next + 1, next);
    }
  return meshOf(positions, indices);
};

/**
 * Sweep a convex 2D profile along a 3D polyline using a stable local frame.
 *
 * This is the code path for moulding, rails, pipes, arches, and other members
 * whose section repeats along a path. Adjacent path points must be distinct.
 */
export const sweepAutoMovieProfile = (props: {
  profile: readonly IAutoMovieProfilePoint[];
  path: readonly IAutoMovieVector3[];
}): IAutoMovieMesh => {
  const profile = profileHull(props.profile);
  if (props.path.length < 2)
    throw new Error("sweep path needs at least two points");
  props.path.forEach((point, index) =>
    finiteVector(point, `sweep path[${index}]`),
  );
  const positions: number[] = [];
  props.path.forEach((point, index) => {
    const tangent = tangentAt(props.path, index);
    const guide =
      Math.abs(tangent.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const right = Vector3.normalize(Vector3.cross(guide, tangent));
    const up = Vector3.normalize(Vector3.cross(tangent, right));
    for (const profilePoint of profile)
      positions.push(
        point.x + right.x * profilePoint.x + up.x * profilePoint.y,
        point.y + right.y * profilePoint.x + up.y * profilePoint.y,
        point.z + right.z * profilePoint.x + up.z * profilePoint.y,
      );
  });
  const count = profile.length;
  const indices: number[] = [];
  for (let ring = 0; ring + 1 < props.path.length; ++ring)
    for (let point = 0; point < count; ++point) {
      const nextPoint = (point + 1) % count;
      const current = ring * count + point;
      const nextRing = current + count;
      indices.push(current, nextPoint + ring * count, nextRing);
      indices.push(
        nextPoint + ring * count,
        nextRing + nextPoint - point,
        nextRing,
      );
    }
  for (let point = 1; point + 1 < count; ++point) {
    indices.push(0, point + 1, point);
    const last = (props.path.length - 1) * count;
    indices.push(last, last + point, last + point + 1);
  }
  return meshOf(positions, indices);
};

/**
 * Build a local XY wall around rectangular door/window openings.
 *
 * The wall is partitioned at every opening edge and each occupied cell becomes
 * one box. Openings therefore remain real holes in beauty, depth, normal, and
 * mask passes instead of metadata painted over an uncut wall.
 */
export const buildAutoMovieWall = (props: {
  width: number;
  height: number;
  depth: number;
  openings: readonly IAutoMovieWallOpening[];
}): IAutoMovieMesh => {
  positive(props.width, "wall width");
  positive(props.height, "wall height");
  positive(props.depth, "wall depth");
  const ids = new Set<string>();
  props.openings.forEach((opening, index) => {
    if (opening.id.trim().length === 0)
      throw new Error(`wall opening[${index}] id must be non-empty`);
    if (ids.has(opening.id))
      throw new Error(`wall opening id "${opening.id}" must be unique`);
    ids.add(opening.id);
    finiteOpening(opening, index);
    if (
      opening.x < 0 ||
      opening.y < 0 ||
      opening.x + opening.width > props.width ||
      opening.y + opening.height > props.height
    )
      throw new Error(`wall opening "${opening.id}" must stay inside the wall`);
  });
  for (let left = 0; left < props.openings.length; ++left)
    for (let right = left + 1; right < props.openings.length; ++right)
      if (overlaps(props.openings[left]!, props.openings[right]!))
        throw new Error(
          `wall openings "${props.openings[left]!.id}" and "${props.openings[right]!.id}" overlap`,
        );

  const xs = sortedCuts([
    0,
    props.width,
    ...props.openings.flatMap((opening) => [
      opening.x,
      opening.x + opening.width,
    ]),
  ]);
  const ys = sortedCuts([
    0,
    props.height,
    ...props.openings.flatMap((opening) => [
      opening.y,
      opening.y + opening.height,
    ]),
  ]);
  const cells: IAutoMovieMesh[] = [];
  for (let x = 0; x + 1 < xs.length; ++x)
    for (let y = 0; y + 1 < ys.length; ++y) {
      const centerX = (xs[x]! + xs[x + 1]!) / 2;
      const centerY = (ys[y]! + ys[y + 1]!) / 2;
      if (
        props.openings.some(
          (opening) =>
            centerX > opening.x &&
            centerX < opening.x + opening.width &&
            centerY > opening.y &&
            centerY < opening.y + opening.height,
        )
      )
        continue;
      cells.push(
        translateMesh(
          tessellateToMesh({
            type: "box",
            width: xs[x + 1]! - xs[x]!,
            height: ys[y + 1]! - ys[y]!,
            depth: props.depth,
          }),
          {
            x: centerX - props.width / 2,
            y: centerY - props.height / 2,
            z: 0,
          },
        ),
      );
    }
  if (cells.length === 0)
    throw new Error("wall openings remove the entire wall");
  return mergeAutoMovieMeshes(cells);
};

/** Merge rigid meshes, rebasing their indices in declared order. */
export const mergeAutoMovieMeshes = (
  meshes: readonly IAutoMovieMesh[],
): IAutoMovieMesh => {
  if (meshes.some((mesh) => mesh.skin !== null))
    throw new Error("procedural rigid-mesh merge does not accept skinning");
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const keepNormals = meshes.every((mesh) => mesh.normals !== null);
  const keepUvs = meshes.every((mesh) => mesh.uvs !== null);
  const uvs: number[] = [];
  for (const mesh of meshes) {
    const base = positions.length / 3;
    const count = mesh.positions.length / 3;
    positions.push(...mesh.positions);
    if (keepNormals) normals.push(...mesh.normals!);
    if (keepUvs) uvs.push(...mesh.uvs!);
    const sourceIndices =
      mesh.indices ?? Array.from({ length: count }, (_, index) => index);
    indices.push(...sourceIndices.map((index) => index + base));
  }
  return {
    positions,
    normals: keepNormals ? normals : null,
    uvs: keepUvs ? uvs : null,
    indices,
    skin: null,
  };
};

const profileHull = (
  profile: readonly IAutoMovieProfilePoint[],
): IAutoMovieProfilePoint[] => {
  profile.forEach((point, index) => finitePoint(point, `profile[${index}]`));
  const hull = convexHull2D(
    profile.map((point) => ({ x: point.x, y: 0, z: point.y })),
  ).map((point) => ({ x: point.x, y: point.z }));
  if (hull.length < 3)
    throw new Error("profile needs at least three non-collinear points");
  if (hull.length !== profile.length)
    throw new Error("profile must be convex and contain no interior points");
  return hull;
};

const tangentAt = (
  path: readonly IAutoMovieVector3[],
  index: number,
): IAutoMovieVector3 => {
  const from = index === 0 ? path[0]! : path[index - 1]!;
  const to = index + 1 === path.length ? path[index]! : path[index + 1]!;
  const delta = Vector3.subtract(to, from);
  if (Vector3.length(delta) <= Number.EPSILON)
    throw new Error(`sweep path around point ${index} is degenerate`);
  return Vector3.normalize(delta);
};

const meshOf = (positions: number[], indices: number[]): IAutoMovieMesh => ({
  positions,
  normals: normalsOf(positions, indices),
  uvs: null,
  indices,
  skin: null,
});

const normalsOf = (positions: number[], indices: number[]): number[] => {
  const normals = new Array<number>(positions.length).fill(0);
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index]! * 3;
    const b = indices[index + 1]! * 3;
    const c = indices[index + 2]! * 3;
    const ab = {
      x: positions[b]! - positions[a]!,
      y: positions[b + 1]! - positions[a + 1]!,
      z: positions[b + 2]! - positions[a + 2]!,
    };
    const ac = {
      x: positions[c]! - positions[a]!,
      y: positions[c + 1]! - positions[a + 1]!,
      z: positions[c + 2]! - positions[a + 2]!,
    };
    const normal = Vector3.cross(ab, ac);
    for (const offset of [a, b, c]) {
      normals[offset] += normal.x;
      normals[offset + 1] += normal.y;
      normals[offset + 2] += normal.z;
    }
  }
  for (let index = 0; index < normals.length; index += 3) {
    const normal = Vector3.normalize({
      x: normals[index]!,
      y: normals[index + 1]!,
      z: normals[index + 2]!,
    });
    normals[index] = normal.x;
    normals[index + 1] = normal.y;
    normals[index + 2] = normal.z;
  }
  return normals;
};

const translateMesh = (
  mesh: IAutoMovieMesh,
  translation: IAutoMovieVector3,
): IAutoMovieMesh => ({
  ...mesh,
  positions: mesh.positions.map((value, index) => {
    const axis = index % 3;
    return (
      value +
      (axis === 0 ? translation.x : axis === 1 ? translation.y : translation.z)
    );
  }),
});

const sortedCuts = (values: number[]): number[] =>
  [...new Set(values)].sort((left, right) => left - right);

const overlaps = (
  left: IAutoMovieWallOpening,
  right: IAutoMovieWallOpening,
): boolean =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

const finiteOpening = (opening: IAutoMovieWallOpening, index: number): void => {
  finitePoint(opening, `wall opening[${index}]`);
  positive(opening.width, `wall opening[${index}] width`);
  positive(opening.height, `wall opening[${index}] height`);
};

const finitePoint = (point: IAutoMovieProfilePoint, label: string): void => {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new Error(`${label} must be finite`);
};

const finiteVector = (point: IAutoMovieVector3, label: string): void => {
  if (![point.x, point.y, point.z].every(Number.isFinite))
    throw new Error(`${label} must be finite`);
};

const positive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${label} must be a finite number > 0`);
};

const segments = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < 3)
    throw new Error(`${label} must be a safe integer >= 3`);
};
