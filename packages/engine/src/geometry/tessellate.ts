import { AutoMoviePrimitiveShape, IAutoMovieMesh } from "@automovie/interface";

/**
 * Flat-array triangle mesh produced by tessellation: parallel `positions` /
 * `normals` (xyz triples) and triangle `indices`. This is the render-ready form
 * a renderer uploads to the GPU, and matches the shape of {@link IAutoMovieMesh}
 * (minus skinning).
 */
export interface ITessellation {
  positions: number[];
  normals: number[];
  indices: number[];
}

/**
 * Tessellate a {@link AutoMoviePrimitiveShape} into a triangle mesh.
 *
 * Lets the LLM-authored "named dimensions" path (a 0.4 m sphere, a capsule)
 * become concrete geometry a renderer can draw, without the model ever emitting
 * vertices. The engine owns this so generated primitives render identically
 * everywhere.
 *
 * @author Samchon
 */
export const tessellate = (shape: AutoMoviePrimitiveShape): ITessellation => {
  switch (shape.type) {
    case "box":
      return box(shape.width, shape.height, shape.depth);
    case "plane":
      return box(shape.width, 0, shape.depth);
    case "sphere":
      return sphere(shape.radius, 16, 12);
    case "cylinder":
      return cylinder(shape.radius, shape.radius, shape.height, 16);
    case "cone":
      return cylinder(shape.radius, 0, shape.height, 16);
    case "capsule":
      // Approximate a capsule by its closed bounding cylinder for now (the
      // SPHERICAL end caps are a future refinement); height spans body + both
      // radii.
      return cylinder(
        shape.radius,
        shape.radius,
        shape.height + 2 * shape.radius,
        16,
      );
    default: {
      const unknown = shape as unknown as { type: unknown };
      throw new Error(`unknown primitive shape "${String(unknown.type)}"`);
    }
  }
};

/** Tessellate, then wrap as a full {@link IAutoMovieMesh} (no skinning). */
export const tessellateToMesh = (
  shape: AutoMoviePrimitiveShape,
): IAutoMovieMesh => {
  const t = tessellate(shape);
  return {
    positions: t.positions,
    normals: t.normals,
    uvs: null,
    indices: t.indices,
    skin: null,
  };
};

const box = (w: number, h: number, d: number): ITessellation => {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const faces: ReadonlyArray<[number[], number[]]> = [
    [
      [x, -y, -z, x, y, -z, x, y, z, x, -y, z],
      [1, 0, 0],
    ], // +X
    [
      [-x, -y, z, -x, y, z, -x, y, -z, -x, -y, -z],
      [-1, 0, 0],
    ], // -X
    [
      [-x, y, -z, -x, y, z, x, y, z, x, y, -z],
      [0, 1, 0],
    ], // +Y
    [
      [-x, -y, z, -x, -y, -z, x, -y, -z, x, -y, z],
      [0, -1, 0],
    ], // -Y
    [
      [-x, -y, z, x, -y, z, x, y, z, -x, y, z],
      [0, 0, 1],
    ], // +Z
    [
      [x, -y, -z, -x, -y, -z, -x, y, -z, x, y, -z],
      [0, 0, -1],
    ], // -Z
  ];
  for (const [verts, n] of faces) {
    const base = positions.length / 3;
    for (let i = 0; i < 4; ++i) {
      positions.push(verts[i * 3]!, verts[i * 3 + 1]!, verts[i * 3 + 2]!);
      normals.push(n[0]!, n[1]!, n[2]!);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, indices };
};

const sphere = (
  radius: number,
  segments: number,
  rings: number,
): ITessellation => {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rings; ++r) {
    const phi = (r / rings) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let s = 0; s <= segments; ++s) {
      const theta = (s / segments) * Math.PI * 2;
      const nx = sinPhi * Math.cos(theta);
      const ny = cosPhi;
      const nz = sinPhi * Math.sin(theta);
      normals.push(nx, ny, nz);
      positions.push(nx * radius, ny * radius, nz * radius);
    }
  }
  const stride = segments + 1;
  // wind counter-clockwise seen from OUTSIDE (#1053), the glTF front-face
  // contract, and what a front-side renderer needs to not cull the surface
  for (let r = 0; r < rings; ++r)
    for (let s = 0; s < segments; ++s) {
      const a = r * stride + s;
      const b = a + stride;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  return { positions, normals, indices };
};

const cylinder = (
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
): ITessellation => {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const halfH = height / 2;
  // Side ring (top then bottom). The outward normal follows the SLANT (#1143):
  // the profile line (radiusTop, +h/2) → (radiusBottom, −h/2) has the outward
  // perpendicular (height, radiusBottom − radiusTop) in the (radial, y) plane,
  // which degenerates to the horizontal ring normal at equal radii.
  const slant = Math.hypot(height, radiusBottom - radiusTop);
  const nRadial = height / slant;
  const nY = (radiusBottom - radiusTop) / slant;
  for (let s = 0; s <= segments; ++s) {
    const theta = (s / segments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    positions.push(cos * radiusTop, halfH, sin * radiusTop);
    normals.push(cos * nRadial, nY, sin * nRadial);
    positions.push(cos * radiusBottom, -halfH, sin * radiusBottom);
    normals.push(cos * nRadial, nY, sin * nRadial);
  }
  // counter-clockwise from outside, matching the sphere lattice (#1053)
  for (let s = 0; s < segments; ++s) {
    const a = s * 2;
    indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  // Cap disks close the solid (#1143): a fan per non-degenerate end, flat ±Y
  // normals, wound counter-clockwise seen from outside like everything else.
  // Without them the tube is open and a top-down framing sees through the prop.
  const cap = (radius: number, y: number, up: 1 | -1): void => {
    if (radius <= 0) return; // a cone's apex end is a point, not a disk
    const center = positions.length / 3;
    positions.push(0, y, 0);
    normals.push(0, up, 0);
    for (let s = 0; s <= segments; ++s) {
      const theta = (s / segments) * Math.PI * 2;
      positions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
      normals.push(0, up, 0);
    }
    for (let s = 0; s < segments; ++s) {
      const a = center + 1 + s;
      if (up === 1) indices.push(center, a + 1, a);
      else indices.push(center, a, a + 1);
    }
  };
  cap(radiusTop, halfH, 1);
  cap(radiusBottom, -halfH, -1);
  return { positions, normals, indices };
};
