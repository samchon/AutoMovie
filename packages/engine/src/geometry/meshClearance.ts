import type { IAutoMovieMesh } from "@automovie/interface";

type Triangle = { points: number[][]; area: number; bounds: number[] };

/**
 * Measure front-minus-back depth over the complete projected overlap of two
 * triangle meshes. Each returned entry belongs to a front triangle and gives
 * its smallest signed separation from any back triangle, in mesh-local metres.
 * Positive is clear, zero is contact, negative violates the declared ordering.
 * An unreported triangle has no projected overlap. Neither input is changed.
 *
 * The depth difference is affine on each triangle-pair intersection polygon,
 * so its minimum occurs at a polygon vertex. Checking only mesh vertices misses
 * crossing edges and a curved resident surface inside a larger front triangle.
 * Coordinates for X/Y/Z depth are YZ/ZX/XY. Ray-parallel triangles are skipped:
 * this is directional surface ordering, not a closed-volume collision test.
 * Inputs must already share a frame; callers own transforms and contact pairs.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Measures resident triangle separation for subsequent rigid placement or shared-surface contact without subject-specific geometry.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Retains front triangle ordinals while evaluating their complete projected overlap with the supporting mesh.
 */
export function measureAutoMovieMeshClearance(
  front: IAutoMovieMesh,
  back: IAutoMovieMesh,
  axis: "x" | "y" | "z",
): { triangle: number; minimum: number }[] {
  if (axis !== "x" && axis !== "y" && axis !== "z")
    throw new Error("Mesh clearance needs an X, Y or Z depth axis.");
  const axes = { x: [1, 2, 0], y: [2, 0, 1], z: [0, 1, 2] }[axis];
  const fronts = triangles(front, axes),
    backs = triangles(back, axes);
  // Sort one projected interval for broad-phase rejection; every surviving
  // candidate still receives polygon clipping and actual plane evaluation.
  const ordered = backs
    .filter((t) => t.area !== 0)
    .sort((a, b) => a.bounds[0] - b.bounds[0]);
  const result: { triangle: number; minimum: number }[] = [];
  for (const [triangle, a] of fronts.entries()) {
    if (a.area === 0) continue;
    let minimum = Infinity;
    for (const b of ordered) {
      if (b.bounds[0] > a.bounds[2]) break;
      if (
        b.bounds[2] < a.bounds[0] ||
        b.bounds[3] < a.bounds[1] ||
        b.bounds[1] > a.bounds[3]
      )
        continue;
      const overlap = clip(a.points, b);
      for (const point of overlap) {
        const gap = depth(a, point) - depth(b, point);
        if (!Number.isFinite(gap))
          throw new Error("Mesh clearance arithmetic must remain finite.");
        minimum = Math.min(minimum, gap);
      }
    }
    if (minimum !== Infinity) result.push({ triangle, minimum });
  }
  return result;
}

function triangles(mesh: IAutoMovieMesh, axes: number[]): Triangle[] {
  const indices =
    mesh.indices ??
    Array.from({ length: mesh.positions.length / 3 }, (_, i) => i);
  if (
    mesh.positions.length % 3 !== 0 ||
    !mesh.positions.every(Number.isFinite) ||
    indices.length % 3 !== 0 ||
    indices.some(
      (i) => !Number.isInteger(i) || i < 0 || i >= mesh.positions.length / 3,
    )
  )
    throw new Error("Mesh clearance needs finite complete triangle buffers.");
  const result: Triangle[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices
      .slice(i, i + 3)
      .map((id) => axes.map((axis) => mesh.positions[3 * id + axis]));
    const area = side(points[0], points[1], points[2]);
    if (!Number.isFinite(area))
      throw new Error("Mesh clearance projected area must remain finite.");
    result.push({
      points,
      area,
      bounds: [
        Math.min(...points.map((p) => p[0])),
        Math.min(...points.map((p) => p[1])),
        Math.max(...points.map((p) => p[0])),
        Math.max(...points.map((p) => p[1])),
      ],
    });
  }
  return result;
}

function side(a: number[], b: number[], p: number[]): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

function depth(triangle: Triangle, p: number[]): number {
  const [a, b, c] = triangle.points;
  const beta = side(a, p, c) / triangle.area,
    gamma = side(a, b, p) / triangle.area;
  return a[2] * (1 - beta - gamma) + b[2] * beta + c[2] * gamma;
}

function clip(points: number[][], triangle: Triangle): number[][] {
  let polygon = points;
  const sign = Math.sign(triangle.area);
  for (let edge = 0; edge < 3; edge++) {
    const a = triangle.points[edge],
      b = triangle.points[(edge + 1) % 3];
    const input = polygon;
    polygon = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i],
        previous = input[(i + input.length - 1) % input.length];
      const dc = sign * side(a, b, current),
        dp = sign * side(a, b, previous);
      if (!Number.isFinite(dc) || !Number.isFinite(dp))
        throw new Error("Mesh clearance clipping must remain finite.");
      if (dc >= 0 !== dp >= 0) {
        // Normalize before dividing: dp-dc can overflow for finite opposite
        // signs, whereas these bounded signed ratios retain the same crossing.
        const scale = Math.max(Math.abs(dp), Math.abs(dc));
        const t = dp / scale / (dp / scale - dc / scale);
        polygon.push(
          [0, 1].map((axis) => previous[axis] * (1 - t) + current[axis] * t),
        );
      }
      if (dc >= 0) polygon.push(current);
    }
  }
  return polygon;
}
