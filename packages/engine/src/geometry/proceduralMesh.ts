import {
  IAutoMovieMesh,
  IAutoMovieQuaternion,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
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

/** A rigid translate / unit-quaternion rotate / per-axis scale placement. */
export interface IAutoMovieMeshTransform {
  /** Metres added after rotation and scale; omitted means the origin. */
  translation?: IAutoMovieVector3;
  /** Unit quaternion applied after scale; omitted means identity. */
  rotation?: IAutoMovieQuaternion;
  /** Per-axis scale applied first; omitted means unit scale. */
  scale?: IAutoMovieVector3;
}

/** One named member of an assembly, optionally placed by its own transform. */
export interface IAutoMovieMeshPart {
  /** Stable member identity, unique inside one assembly. */
  id: string;
  /** The member's geometry in its own local frame. */
  mesh: IAutoMovieMesh;
  /** Where the member sits in the assembly frame. */
  transform?: IAutoMovieMeshTransform;
}

/** The index range one assembly member occupies in the merged mesh. */
export interface IAutoMovieMeshGroup {
  /** The contributing {@link IAutoMovieMeshPart.id}. */
  id: string;
  /** First index of the member's triangles inside the merged index array. */
  start: number;
  /** How many indices the member contributes; always a multiple of three. */
  count: number;
}

/** One merged mesh plus the material groups its members occupy. */
export interface IAutoMovieMeshAssembly {
  /** The merged rigid mesh. */
  mesh: IAutoMovieMesh;
  /** Declaration-ordered index ranges, one per contributing member. */
  groups: IAutoMovieMeshGroup[];
}

/** What a mesh's triangle topology actually is, measured rather than assumed. */
export interface IAutoMovieMeshTopology {
  /** Triangle count, including degenerate ones. */
  triangles: number;
  /** Triangles whose welded corners are not three distinct points. */
  degenerate: number;
  /** Position, normal, or uv components that are not finite numbers. */
  nonFinite: number;
  /** Welded edges used by exactly one triangle: the open boundary. */
  boundaryEdges: number;
  /** Welded edges used by three or more triangles. */
  nonManifoldEdges: number;
  /** True when every welded edge is shared by exactly two triangles. */
  watertight: boolean;
  /** Divergence-theorem signed volume; exact for a closed polyhedron. */
  volume: number;
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

/**
 * Revolve a radius/height profile around local Y into a closed surface.
 *
 * Unlike extrusion and sweep, the meridian is taken as authored rather than
 * hulled, so an arbitrary silhouette polyline is allowed here; only its radii
 * must be non-negative.
 */
export const revolveAutoMovieProfile = (props: {
  profile: readonly IAutoMovieProfilePoint[];
  segments: number;
}): IAutoMovieMesh => {
  if (props.profile.length < 2)
    throw new Error("revolve profile needs at least two points");
  countAtLeast(props.segments, 3, "revolve segments");
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
 * Build a boundary representation from planar polygonal faces.
 *
 * Extrusion, revolution, and sweep each impose a shape on the result; this is
 * the general escape for a solid whose faces are simply stated, such as a
 * ridged roof, a wedge, or a chamfered pier, without dropping to authored
 * vertex arrays. Each face owns its corners, so its normal stays flat across
 * the seam and its UV frame is the face's own plane measured in metres.
 *
 * Faces are refused, never quietly repaired: fewer than three corners, a
 * non-finite corner, a collinear face carrying no area, a corner off the face's
 * own plane, and a reflex corner each raise their own diagnostic. Convexity is
 * demanded because the face is fanned from its first corner, and fanning a
 * concave outline emits triangles that cover ground the face does not. Whether
 * the result is a closed shell is the caller's declaration to make and
 * {@link inspectAutoMovieMeshTopology}'s to check.
 */
export const buildAutoMoviePolyhedron = (
  faces: ReadonlyArray<readonly IAutoMovieVector3[]>,
): IAutoMovieMesh => {
  if (faces.length === 0) throw new Error("polyhedron needs at least one face");
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  faces.forEach((corners, face) => {
    if (corners.length < 3)
      throw new Error(`polyhedron face[${face}] needs at least three corners`);
    corners.forEach((corner, index) =>
      finiteVector(corner, `polyhedron face[${face}] corner[${index}]`),
    );
    const origin = corners[0]!;
    const spans = Vector3.cross(
      Vector3.subtract(corners[1]!, origin),
      Vector3.subtract(corners[corners.length - 1]!, origin),
    );
    if (Vector3.length(spans) <= FACE_EPSILON)
      throw new Error(`polyhedron face[${face}] encloses no area`);
    const normal = Vector3.normalize(spans);
    if (
      corners.some(
        (corner) =>
          Math.abs(Vector3.dot(Vector3.subtract(corner, origin), normal)) >
          FACE_EPSILON,
      )
    )
      throw new Error(`polyhedron face[${face}] is not planar`);
    for (let index = 0; index < corners.length; ++index) {
      const previous = corners[(index + corners.length - 1) % corners.length]!;
      const current = corners[index]!;
      const next = corners[(index + 1) % corners.length]!;
      if (
        Vector3.dot(
          Vector3.cross(
            Vector3.subtract(current, previous),
            Vector3.subtract(next, current),
          ),
          normal,
        ) < -FACE_EPSILON
      )
        throw new Error(`polyhedron face[${face}] must be convex`);
    }
    const axisU = Vector3.normalize(Vector3.subtract(corners[1]!, origin));
    const axisV = Vector3.cross(normal, axisU);
    const base = positions.length / 3;
    for (const corner of corners) {
      const delta = Vector3.subtract(corner, origin);
      positions.push(corner.x, corner.y, corner.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(Vector3.dot(delta, axisU), Vector3.dot(delta, axisV));
    }
    for (let index = 1; index + 1 < corners.length; ++index)
      indices.push(base, base + index, base + index + 1);
  });
  return { positions, normals, uvs, indices, skin: null };
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

/**
 * Place a rigid mesh by translation, unit quaternion, and per-axis scale.
 *
 * Positions take the full placement, normals take the inverse transpose (so a
 * non-uniform scale does not tilt them off the surface), and a mirroring scale
 * flips triangle winding so the outward face stays outward. UVs ride along
 * untouched, because a placement moves a surface without re-cutting its atlas.
 */
export const transformAutoMovieMesh = (
  mesh: IAutoMovieMesh,
  transform: IAutoMovieMeshTransform,
): IAutoMovieMesh => {
  if (mesh.skin !== null)
    throw new Error("procedural mesh transform does not accept skinning");
  const triangles = triangleIndicesOf(mesh, "mesh transform");
  const translation = transform.translation ?? { x: 0, y: 0, z: 0 };
  finiteVector(translation, "mesh transform translation");
  const rotation = transform.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  if (
    ![rotation.x, rotation.y, rotation.z, rotation.w].every(Number.isFinite) ||
    Math.abs(Math.hypot(rotation.x, rotation.y, rotation.z, rotation.w) - 1) >
      1e-6
  )
    throw new Error("mesh transform rotation must be a unit quaternion");
  const scale = transform.scale ?? { x: 1, y: 1, z: 1 };
  finiteVector(scale, "mesh transform scale");
  if (scale.x === 0 || scale.y === 0 || scale.z === 0)
    throw new Error("mesh transform scale may not collapse an axis");
  const positions: number[] = [];
  for (let index = 0; index < mesh.positions.length; index += 3) {
    const placed = Quaternion.rotateVector(rotation, {
      x: mesh.positions[index]! * scale.x,
      y: mesh.positions[index + 1]! * scale.y,
      z: mesh.positions[index + 2]! * scale.z,
    });
    positions.push(
      placed.x + translation.x,
      placed.y + translation.y,
      placed.z + translation.z,
    );
  }
  const source = mesh.normals ?? [];
  const normals: number[] = [];
  for (let index = 0; index < source.length; index += 3) {
    const turned = Vector3.normalize(
      Quaternion.rotateVector(rotation, {
        x: source[index]! / scale.x,
        y: source[index + 1]! / scale.y,
        z: source[index + 2]! / scale.z,
      }),
    );
    normals.push(turned.x, turned.y, turned.z);
  }
  const mirrored = scale.x * scale.y * scale.z < 0;
  const indices: number[] = [];
  for (let index = 0; index < triangles.length; index += 3)
    indices.push(
      triangles[index]!,
      triangles[index + (mirrored ? 2 : 1)]!,
      triangles[index + (mirrored ? 1 : 2)]!,
    );
  return {
    positions,
    normals: mesh.normals === null ? null : normals,
    uvs: mesh.uvs === null ? null : [...mesh.uvs],
    indices,
    skin: null,
  };
};

/**
 * Merge placed rigid members and report the index range each one owns.
 *
 * A material group is what lets one merged draw call still say which triangles
 * are the tread and which are the riser, so a finish, a budget, or a quantity
 * take-off can address a member after the buffers were concatenated.
 */
export const mergeAutoMovieMeshParts = (
  parts: readonly IAutoMovieMeshPart[],
): IAutoMovieMeshAssembly => {
  const seen = new Set<string>();
  for (const part of parts) {
    if (part.id.trim().length === 0)
      throw new Error("mesh part id must be non-empty");
    if (seen.has(part.id))
      throw new Error(`mesh part id "${part.id}" must be unique`);
    seen.add(part.id);
  }
  const placed = parts.map((part) => {
    triangleIndicesOf(part.mesh, `mesh part "${part.id}"`);
    return part.transform === undefined
      ? part.mesh
      : transformAutoMovieMesh(part.mesh, part.transform);
  });
  const groups: IAutoMovieMeshGroup[] = [];
  let start = 0;
  placed.forEach((mesh, index) => {
    const count = mesh.indices?.length ?? mesh.positions.length / 3;
    groups.push({ id: parts[index]!.id, start, count });
    start += count;
  });
  return { mesh: mergeAutoMovieMeshes(placed), groups };
};

/**
 * Measure a mesh's triangle topology instead of assuming it.
 *
 * Vertices weld by position, because a builder that gives each face its own
 * corners is still one closed shell. A closed solid must report `watertight`;
 * an assembly of members that share faces, or a surface meant to stay open,
 * reports its boundary and non-manifold edge counts rather than pretending.
 */
export const inspectAutoMovieMeshTopology = (
  mesh: IAutoMovieMesh,
): IAutoMovieMeshTopology => {
  const nonFinite = [
    ...mesh.positions,
    ...(mesh.normals ?? []),
    ...(mesh.uvs ?? []),
  ].filter((value) => Number.isFinite(value) === false).length;
  const indices = triangleIndicesOf(mesh, "mesh topology");
  const key = (at: number): string =>
    [0, 1, 2]
      .map((axis) => Math.round(mesh.positions[at * 3 + axis]! * WELD_SCALE))
      .join(",");
  const edges = new Map<string, number>();
  let degenerate = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const corners = [0, 1, 2].map((corner) => key(indices[index + corner]!));
    if (new Set(corners).size < 3) {
      degenerate += 1;
      continue;
    }
    for (let edge = 0; edge < 3; ++edge) {
      // The degenerate skip above leaves three distinct corner keys, so the
      // two ends of an edge can never compare equal here.
      const name = [corners[edge]!, corners[(edge + 1) % 3]!]
        .sort((left, right) => (left < right ? -1 : 1))
        .join("|");
      edges.set(name, (edges.get(name) ?? 0) + 1);
    }
  }
  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edges.values())
    if (count === 1) boundaryEdges += 1;
    else if (count > 2) nonManifoldEdges += 1;
  let sixVolume = 0;
  const p = mesh.positions;
  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index]! * 3;
    const b = indices[index + 1]! * 3;
    const c = indices[index + 2]! * 3;
    sixVolume +=
      p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) +
      p[a + 1]! * (p[b + 2]! * p[c]! - p[b]! * p[c + 2]!) +
      p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!);
  }
  return {
    triangles: indices.length / 3,
    degenerate,
    nonFinite,
    boundaryEdges,
    nonManifoldEdges,
    watertight: edges.size > 0 && boundaryEdges === 0 && nonManifoldEdges === 0,
    volume: sixVolume / 6,
  };
};

/**
 * The triangle index run a mesh carries, refused rather than read past its end.
 *
 * An index array that is not a whole number of triangles, or that names a
 * vertex the mesh does not carry, would otherwise read `undefined` and emit
 * `NaN` positions and a `NaN` volume that no downstream check attributes back
 * to the malformed input.
 */
const triangleIndicesOf = (mesh: IAutoMovieMesh, label: string): number[] => {
  const vertices = mesh.positions.length / 3;
  if (Number.isSafeInteger(vertices) === false)
    throw new Error(`${label} needs positions in whole xyz triples`);
  const indices =
    mesh.indices ?? Array.from({ length: vertices }, (_, index) => index);
  if (indices.length % 3 !== 0)
    throw new Error(`${label} needs triangle indices in threes`);
  if (
    indices.some(
      (index) =>
        Number.isSafeInteger(index) === false || index < 0 || index >= vertices,
    )
  )
    throw new Error(`${label} indexes a vertex the mesh does not carry`);
  return indices;
};

/** Welding grid for topology queries: 1 nm, far below any building tolerance. */
const WELD_SCALE = 1e9;

/** Largest out-of-plane or degenerate-area slack one authored face may carry. */
const FACE_EPSILON = 1e-9;

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

const countAtLeast = (value: number, least: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value < least)
    throw new Error(`${label} must be a safe integer >= ${least}`);
};
