import { Vector3 } from "@automovie/engine";

import type { IPortraitFinalSurfaceHost } from "./portraitFinalSurface";

/**
 * Fair only the interior of a labelled joining region along a fixed view ray.
 * A vertex touching another region is a fixed shared attachment. Its neighbours
 * remain in the energy, so the join reads both surrounding surfaces instead of
 * solving against boundary positions alone. Native core detail is not smoothed.
 *
 * The frozen input metric defines cotangent L and barycentric vertex areas M.
 * The default uses physical surface areas; optional XY uses the fixed planar
 * chart and only admits a Z displacement. It retains XY exactly so a caller's
 * admitted positive triangulation cannot fold during the height solve.
 * We minimize ||M^(-1/2) L (P + d r)||^2 for scalar offsets d on the unit ray r.
 * All boundary/exterior offsets are zero. A matrix-free, diagonally conditioned
 * solve also excludes explicitly fixed interior samples, preserving a boundary
 * derivative already established by the owning component. The remaining
 * conjugate-gradient solve avoids a dense matrix and preserves image projection.
 * The residual must converge; the iteration limit is not a smoothing strength.
 * This discrete energy does not certify exact C1 continuity or nonintersection.
 */
export function fairPortraitSurface(
  host: IPortraitFinalSurfaceHost,
  group: number,
  ray: readonly number[],
  /** Optional nonnegative solver-work limit; omission allows four steps per unknown. */
  maxIterations?: number,
  /** Additional resident positions held fixed, such as an authored first tangent row. */
  fixedVertices: readonly number[] = [],
  /** XY uses projected areas/cotangents and admits only a Z height displacement. */
  metric: "surface" | "xy" = "surface",
): { vertex: number; target: number[] }[] {
  if (
    (metric !== "surface" && metric !== "xy") ||
    (metric === "xy" && (ray[0] !== 0 || ray[1] !== 0)) ||
    !Number.isInteger(group) ||
    group < 0 ||
    fixedVertices.some(
      (v) => !Number.isInteger(v) || v < 0 || v >= host.positions.length,
    ) ||
    (maxIterations !== undefined &&
      (!Number.isInteger(maxIterations) || maxIterations < 0)) ||
    ray.length !== 3 ||
    !ray.every(Number.isFinite) ||
    host.groups.length * 3 !== host.indices.length ||
    host.indices.some(
      (v) => !Number.isInteger(v) || v < 0 || v >= host.positions.length,
    ) ||
    host.positions.some((p) => p.length !== 3 || !p.every(Number.isFinite))
  )
    throw new Error(
      "Surface fairing needs valid resident triangles and a finite ray.",
    );
  const direction = Vector3.normalize(
    Vector3.create(...(ray as [number, number, number])),
  );
  if (Vector3.length(direction) === 0)
    throw new Error("Surface fairing needs a nonzero ray.");
  const inside = new Set<number>(),
    outside = new Set<number>();
  for (let f = 0; f < host.groups.length; f++) {
    const set = host.groups[f] === group ? inside : outside;
    for (let c = 0; c < 3; c++) set.add(host.indices[f * 3 + c]);
  }
  const fixed = new Set(fixedVertices);
  const free = [...inside]
    .filter((v) => !outside.has(v) && !fixed.has(v))
    .sort((a, b) => a - b);
  if (free.length === 0) return [];
  const lookup = new Map(free.map((v, i) => [v, i]));
  const rows = new Map<
    number,
    { mass: number; entries: Map<number, number> }
  >();
  for (let f = 0; f < host.indices.length; f += 3) {
    const tri = host.indices.slice(f, f + 3);
    if (tri.some((v) => lookup.has(v)))
      for (const v of tri) rows.set(v, { mass: 0, entries: new Map() });
  }
  const points = host.positions.map((p) =>
    Vector3.create(...(p as [number, number, number])),
  );
  // A height solve measures derivatives in the fixed chart. The current 3D
  // surface's distorted lengths and areas must not define that planar metric.
  // Keep physical points separately: their Z values still define the energy.
  const metricPoints =
    metric === "xy" ? points.map((p) => Vector3.create(p.x, p.y, 0)) : points;
  for (let f = 0; f < host.indices.length; f += 3) {
    const tri = host.indices.slice(f, f + 3);
    if (!tri.some((v) => rows.has(v))) continue;
    const [a, b, c] = tri.map((v) => metricPoints[v]);
    const area2 = Vector3.length(
      Vector3.cross(Vector3.subtract(b, a), Vector3.subtract(c, a)),
    );
    if (!(area2 > 0) || !Number.isFinite(area2))
      throw new Error(
        "Surface fairing needs nondegenerate supporting triangles.",
      );
    for (const v of tri) {
      const row = rows.get(v);
      if (row !== undefined) row.mass += area2 / 6;
    }
    for (let k = 0; k < 3; k++) {
      const q = tri[k],
        r = tri[(k + 1) % 3],
        s = tri[(k + 2) % 3];
      const weight =
        Vector3.dot(
          Vector3.subtract(metricPoints[r], metricPoints[q]),
          Vector3.subtract(metricPoints[s], metricPoints[q]),
        ) /
        area2 /
        2;
      for (const [v, near] of [
        [r, s],
        [s, r],
      ]) {
        const row = rows.get(v);
        if (row === undefined) continue;
        row.entries.set(near, (row.entries.get(near) ?? 0) + weight);
        row.entries.set(v, (row.entries.get(v) ?? 0) - weight);
      }
    }
  }
  const diagonal = new Float64Array(free.length),
    rhs = new Float64Array(free.length);
  const matrix = [...rows.values()].map((row) => {
    const scale = 1 / Math.sqrt(row.mass),
      entries: { index: number; value: number }[] = [];
    let value = 0;
    for (const [v, w] of row.entries) {
      value += w * scale * Vector3.dot(points[v], direction);
      const index = lookup.get(v);
      if (index !== undefined) entries.push({ index, value: w * scale });
    }
    for (const e of entries) {
      diagonal[e.index] += e.value * e.value;
      rhs[e.index] -= e.value * value;
    }
    return entries;
  });
  const multiply = (x: Float64Array): Float64Array => {
    const result = new Float64Array(x.length);
    for (const row of matrix) {
      let value = 0;
      for (const e of row) value += e.value * x[e.index];
      for (const e of row) result[e.index] += e.value * value;
    }
    return result;
  };
  const dot = (a: Float64Array, b: Float64Array) =>
    a.reduce((s, v, i) => s + v * b[i], 0);
  const delta = new Float64Array(free.length),
    residual = rhs.slice();
  let conditioned = residual.map((v, i) => v / diagonal[i]),
    search = conditioned.slice(),
    product = dot(residual, conditioned);
  const tolerance = Math.max(1, Math.sqrt(dot(rhs, rhs))) * 1e-9;
  let converged = Math.sqrt(dot(residual, residual)) <= tolerance;
  for (
    let iteration = 0;
    !converged && iteration < (maxIterations ?? free.length * 4);
    iteration++
  ) {
    const applied = multiply(search),
      alpha = product / dot(search, applied);
    for (let i = 0; i < delta.length; i++) {
      delta[i] += alpha * search[i];
      residual[i] -= alpha * applied[i];
    }
    converged = Math.sqrt(dot(residual, residual)) <= tolerance;
    if (converged) break;
    conditioned = residual.map((v, i) => v / diagonal[i]);
    const next = dot(residual, conditioned),
      beta = next / product;
    search = conditioned.map((v, i) => v + beta * search[i]);
    product = next;
  }
  if (!converged) throw new Error("Surface fairing failed to converge.");
  return free.map((vertex, i) => {
    const target = Vector3.add(
      points[vertex],
      Vector3.scale(direction, delta[i]),
    );
    return { vertex, target: [target.x, target.y, target.z] };
  });
}
