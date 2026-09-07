import { Vector3, transformAutoMovieMesh } from "@automovie/engine";
import type {
  IAutoMovieMesh,
  IAutoMovieModelPart,
  IAutoMovieVector3,
} from "@automovie/interface";

type Point = IAutoMovieVector3;
const pi = Math.PI,
  tau = pi * 2;

/** Construct one point in the study's millimetre coordinate frame. */
export const portraitPoint = (x: number, y: number, z: number): Point => ({
  x,
  y,
  z,
});
const p = portraitPoint;
/** Linear interpolation; callers decide whether extrapolation is meaningful. */
export const portraitMix = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/**
 * Intersect a measured camera ray with a continuous finite Z surface, in mm.
 * Moving along this ray preserves the reference image position while allowing
 * the point to sit on the actual eye surface. The supplied interval must
 * bracket a finite root; bisection handles either direction and endpoint roots.
 */
export const portraitRayIntersection = (
  origin: Point,
  direction: Point,
  height: (x: number, y: number) => number,
  interval: [number, number],
): Point => {
  const at = (t: number): Point =>
    p(
      origin.x + direction.x * t,
      origin.y + direction.y * t,
      origin.z + direction.z * t,
    );
  const residual = (t: number): number => {
    const point = at(t);
    return point.z - height(point.x, point.y);
  };
  let [low, high] = interval;
  let left = residual(low);
  const right = residual(high);
  if (!Number.isFinite(left) || !Number.isFinite(right) || left * right > 0)
    throw new Error("A surface intersection needs finite bracketed endpoints.");
  for (let i = 0; i < 40; i++) {
    const middle = (low + high) / 2;
    const value = residual(middle);
    if (left * value <= 0) high = middle;
    else {
      low = middle;
      left = value;
    }
  }
  return at((low + high) / 2);
};

/**
 * Area-weighted normals over shared triangle vertices. Compute these before
 * separating skin and lip material groups so their colour boundary cannot
 * introduce a lighting seam. An unused vertex retains the engine's zero normal.
 */
export const portraitNormals = (
  positions: number[],
  indices: number[],
): number[] => {
  const normals = new Array<number>(positions.length).fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3,
      b = indices[i + 1] * 3,
      c = indices[i + 2] * 3;
    const ab = p(
      positions[b] - positions[a],
      positions[b + 1] - positions[a + 1],
      positions[b + 2] - positions[a + 2],
    );
    const ac = p(
      positions[c] - positions[a],
      positions[c + 1] - positions[a + 1],
      positions[c + 2] - positions[a + 2],
    );
    const normal = Vector3.cross(ab, ac);
    for (let corner = 0; corner < 3; corner++) {
      const at = indices[i + corner] * 3;
      normals[at] += normal.x;
      normals[at + 1] += normal.y;
      normals[at + 2] += normal.z;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const normal = Vector3.normalize(
      p(normals[i], normals[i + 1], normals[i + 2]),
    );
    normals[i] = normal.x;
    normals[i + 1] = normal.y;
    normals[i + 2] = normal.z;
  }
  return normals;
};
const normalsOf = portraitNormals;

/**
 * Extract a labelled triangle region while retaining the parent normal field.
 * Only referenced vertices survive, so a lip or iris part has its own bounds
 * instead of inheriting the complete head's unused position buffer. Identity is
 * the old vertex index, not rounded coordinates; seams are never welded here.
 */
export const portraitRegion = (
  positions: number[],
  normals: number[],
  indices: number[],
): IAutoMovieMesh => {
  const vertices = new Map<number, number>();
  const output: IAutoMovieMesh = {
    positions: [],
    normals: [],
    indices: [],
    uvs: null,
    skin: null,
  };
  for (const old of indices) {
    let next = vertices.get(old);
    if (next === undefined) {
      next = vertices.size;
      vertices.set(old, next);
      const at = old * 3;
      output.positions.push(
        positions[at],
        positions[at + 1],
        positions[at + 2],
      );
      output.normals!.push(normals[at], normals[at + 1], normals[at + 2]);
    }
    output.indices!.push(next);
  }
  return output;
};

/**
 * The sole millimetre-to-metre boundary. Every part uses the engine's same
 * transform, so GLTF export and AutoMovie viewing see identical metric buffers.
 * Geometry is already placed in the head frame; part transforms stay identity.
 */
export const portraitPart = (
  id: string,
  mesh: IAutoMovieMesh,
  finish: string,
): IAutoMovieModelPart & {
  geometry: { type: "mesh"; mesh: IAutoMovieMesh };
} => ({
  id,
  name: id,
  material: finish,
  attachedBone: null,
  transform: null,
  geometry: {
    type: "mesh",
    mesh: transformAutoMovieMesh(mesh, { scale: p(0.001, 0.001, 0.001) }),
  },
});

/**
 * Sample a surface over [0,1] squared and triangulate its shared lattice.
 * The positive normal follows du cross dv. Closure belongs to the surface:
 * a tube without caps remains open, and coincident pole rows are not welded.
 */
export const portraitPatch = (
  surface: (u: number, v: number) => Point,
  columns: number,
  rows: number,
): IAutoMovieMesh => {
  const positions: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= columns; i++) {
      const point = surface(i / columns, j / rows);
      positions.push(point.x, point.y, point.z);
    }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i;
      indices.push(
        a,
        a + 1,
        a + columns + 1,
        a + 1,
        a + columns + 2,
        a + columns + 1,
      );
    }
  return {
    positions,
    indices,
    normals: normalsOf(positions, indices),
    uvs: null,
    skin: null,
  };
};
const patch = portraitPatch;

/**
 * Uniform Catmull-Rom interpolation through at least two ordered landmarks.
 * Progress is clamped, and endpoint neighbours repeat rather than extrapolate.
 * This is a spatial curve, not an arc-length parameterization.
 */
export const portraitSpline = (points: Point[], progress: number): Point => {
  const t = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(t)),
    u = t - i;
  const a = points[Math.max(0, i - 1)],
    b = points[i],
    c = points[i + 1],
    d = points[Math.min(points.length - 1, i + 2)];
  const component = (axis: "x" | "y" | "z"): number =>
    0.5 *
    (2 * b[axis] +
      (-a[axis] + c[axis]) * u +
      (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * u * u +
      (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * u * u * u);
  return p(component("x"), component("y"), component("z"));
};
/**
 * An eight-sided swept strand in the same frame as its guiding curve.
 * The Z guide is suitable for this study's eyelash and eyebrow paths, whose
 * tangents are never parallel to Z. Width is radius, in millimetres.
 */
export const portraitTube = (
  curve: (t: number) => Point,
  width: (t: number) => number,
  rows: number,
): IAutoMovieMesh => {
  // Each ring shares one centre and tangent frame. These curves are pure;
  // recomputing that frame for every side only repeats identical work.
  const frames = Array.from({ length: rows + 1 }, (_, row) => {
    const v = row / rows;
    const at = curve(v);
    const tangent = Vector3.normalize(
      Vector3.subtract(
        curve(Math.min(1, v + 0.0001)),
        curve(Math.max(0, v - 0.0001)),
      ),
    );
    const right = Vector3.normalize(Vector3.cross(p(0, 0, 1), tangent)),
      up = Vector3.cross(tangent, right),
      radius = width(v);
    return { at, right, up, radius };
  });
  return patch(
    (u, v) => {
      const { at, right, up, radius } = frames[Math.round(v * rows)];
      return p(
        at.x +
          radius * (right.x * Math.cos(tau * u) + up.x * Math.sin(tau * u)),
        at.y +
          radius * (right.y * Math.cos(tau * u) + up.y * Math.sin(tau * u)),
        at.z +
          radius * (right.z * Math.cos(tau * u) + up.z * Math.sin(tau * u)),
      );
    },
    8,
    rows,
  );
};
