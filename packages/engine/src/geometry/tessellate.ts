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
      // Approximate a capsule by its bounding cylinder for now (caps are a
      // future refinement); height spans body + both radii.
      return cylinder(
        shape.radius,
        shape.radius,
        shape.height + 2 * shape.radius,
        16,
      );
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
  for (let r = 0; r < rings; ++r)
    for (let s = 0; s < segments; ++s) {
      const a = r * stride + s;
      const b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
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
  // side ring (top then bottom)
  for (let s = 0; s <= segments; ++s) {
    const theta = (s / segments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    positions.push(cos * radiusTop, halfH, sin * radiusTop);
    normals.push(cos, 0, sin);
    positions.push(cos * radiusBottom, -halfH, sin * radiusBottom);
    normals.push(cos, 0, sin);
  }
  for (let s = 0; s < segments; ++s) {
    const a = s * 2;
    indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  return { positions, normals, indices };
};
