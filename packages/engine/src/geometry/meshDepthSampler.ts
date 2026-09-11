import type { IAutoMovieMesh } from "@automovie/interface";

/**
 * Index a resident mesh for repeated axis-aligned surface queries. The result
 * gives the minimum and maximum depth of intersected triangles, or null outside
 * the projected surface. An open surface may return equal depths. Input meshes
 * are snapshotted; queries never depend on later caller mutations.
 *
 * For depth X the query coordinates are Y/Z; for Y they are Z/X; for Z they
 * are X/Y. Coordinates retain the mesh-local metre frame. Triangle winding does
 * not change the envelope. Faces parallel to the query ray supply no isolated
 * intersection and are skipped; triangle edges belong to both neighbours.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Resolves attachment depths from existing resident triangles so a constructed surface can follow its host geometry.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Samples a mesh without changing topology or attributes and retains the caller's metric coordinate frame for dependent geometry.
 * @author Samchon
 */
export function createAutoMovieMeshDepthSampler(
  mesh: IAutoMovieMesh,
  axis: "x" | "y" | "z",
): (u: number, v: number) => { minimum: number; maximum: number } | null {
  if (axis !== "x" && axis !== "y" && axis !== "z")
    throw new Error("A depth sampling axis must be X, Y or Z.");
  const axes = { x: [1, 2, 0], y: [2, 0, 1], z: [0, 1, 2] }[axis];
  const indices =
    mesh.indices ??
    Array.from({ length: mesh.positions.length / 3 }, (_v, i) => i);
  if (
    mesh.positions.length % 3 !== 0 ||
    indices.length % 3 !== 0 ||
    !mesh.positions.every(Number.isFinite) ||
    indices.some(
      (index) =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >= mesh.positions.length / 3,
    )
  )
    throw new Error("Depth sampling needs finite complete triangle buffers.");
  const triangles: { a: number[]; b: number[]; c: number[]; area: number }[] =
    [];
  let minU = Infinity,
    minV = Infinity,
    maxU = -Infinity,
    maxV = -Infinity;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices
      .slice(i, i + 3)
      .map((index) => axes.map((axis) => mesh.positions[3 * index + axis]));
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (!Number.isFinite(area))
      throw new Error("Projected triangle arithmetic must remain finite.");
    if (area === 0) continue;
    triangles.push({ a, b, c, area });
    minU = Math.min(minU, a[0], b[0], c[0]);
    maxU = Math.max(maxU, a[0], b[0], c[0]);
    minV = Math.min(minV, a[1], b[1], c[1]);
    maxV = Math.max(maxV, a[1], b[1], c[1]);
  }
  if (
    triangles.length !== 0 &&
    (!Number.isFinite(maxU - minU) || !Number.isFinite(maxV - minV))
  )
    throw new Error("Projected mesh extent must remain finite.");
  const resolution = 32;
  const cellU = (u: number): number =>
    Math.min(
      resolution - 1,
      Math.floor(resolution * ((u - minU) / (maxU - minU))),
    );
  const cellV = (v: number): number =>
    Math.min(
      resolution - 1,
      Math.floor(resolution * ((v - minV) / (maxV - minV))),
    );
  const bins = new Map<number, typeof triangles>();
  for (const triangle of triangles) {
    const { a, b, c } = triangle;
    for (
      let u = cellU(Math.min(a[0], b[0], c[0]));
      u <= cellU(Math.max(a[0], b[0], c[0]));
      u++
    )
      for (
        let v = cellV(Math.min(a[1], b[1], c[1]));
        v <= cellV(Math.max(a[1], b[1], c[1]));
        v++
      ) {
        const key = u * resolution + v,
          bin = bins.get(key);
        if (bin === undefined) bins.set(key, [triangle]);
        else bin.push(triangle);
      }
  }
  return (u, v) => {
    if (!Number.isFinite(u) || !Number.isFinite(v))
      throw new Error("Surface query coordinates must be finite.");
    if (u < minU || u > maxU || v < minV || v > maxV) return null;
    let minimum = Infinity,
      maximum = -Infinity;
    for (const { a, b, c, area } of bins.get(
      cellU(u) * resolution + cellV(v),
    ) ?? []) {
      const beta =
        ((u - a[0]) * (c[1] - a[1]) - (v - a[1]) * (c[0] - a[0])) / area;
      const gamma =
        ((b[0] - a[0]) * (v - a[1]) - (b[1] - a[1]) * (u - a[0])) / area;
      if (beta < -1e-10 || gamma < -1e-10 || beta + gamma > 1 + 1e-10) continue;
      const depth = a[2] * (1 - beta - gamma) + b[2] * beta + c[2] * gamma;
      if (!Number.isFinite(depth))
        throw new Error("Interpolated surface depth must remain finite.");
      minimum = Math.min(minimum, depth);
      maximum = Math.max(maximum, depth);
    }
    return minimum === Infinity ? null : { minimum, maximum };
  };
}
