import type { IPortraitSkinConstraint } from "./portraitComponents";

/**
 * Adapt neighbouring skin to a set of exact component attachments. Distances
 * travel along the host mesh, so an eye cannot influence nearby but disconnected
 * geometry. Overlapping influence regions solve together; part order does not
 * select which displacement wins. Contradictory attachment positions are refused.
 *
 * Fixed attachment vertices retain their requested positions. The surrounding
 * displacement approximates a positive-weight graph Laplace system against unchanged
 * skin outside the declared reach. This interpolates the seam; it does not infer
 * the anatomical correctness of the component's requested shape.
 */
export function blendPortraitSkin(
  positions: number[][],
  indices: number[],
  constraints: IPortraitSkinConstraint[],
): number[][] {
  const neighbours = positions.map(() => new Map<number, number>());
  for (let i = 0; i < indices.length; i += 3)
    for (let corner = 0; corner < 3; corner++) {
      const a = indices[i + corner],
        b = indices[i + ((corner + 1) % 3)];
      const distance = Math.hypot(
        ...positions[a].map((value, axis) => value - positions[b][axis]),
      );
      neighbours[a].set(b, distance);
      neighbours[b].set(a, distance);
    }
  const fixed = new Map<number, number[]>();
  const reach = new Array<number>(positions.length).fill(0);
  for (const constraint of constraints) {
    if (
      !Number.isInteger(constraint.vertex) ||
      constraint.vertex < 0 ||
      constraint.vertex >= positions.length ||
      constraint.target.length !== 3 ||
      !constraint.target.every(Number.isFinite) ||
      !Number.isFinite(constraint.reach) ||
      constraint.reach < 0
    )
      throw new Error(
        "A skin attachment needs a resident vertex, finite XYZ and nonnegative reach.",
      );
    const previous = fixed.get(constraint.vertex);
    if (
      previous !== undefined &&
      previous.some((value, axis) => value !== constraint.target[axis])
    )
      throw new Error(
        "Two components request different positions for one skin attachment.",
      );
    fixed.set(constraint.vertex, [...constraint.target]);
    reach[constraint.vertex] = Math.max(
      reach[constraint.vertex],
      constraint.reach,
    );
  }
  // Max-remaining-distance propagation is multi-source Dijkstra. The small
  // control cage is scanned deterministically; no runtime mesh cache is involved.
  const visited = new Set<number>();
  for (;;) {
    let next = -1,
      remaining = 0;
    for (let i = 0; i < reach.length; i++)
      if (!visited.has(i) && reach[i] > remaining) {
        next = i;
        remaining = reach[i];
      }
    if (next === -1) break;
    visited.add(next);
    for (const [near, distance] of neighbours[next])
      reach[near] = Math.max(reach[near], remaining - distance);
  }
  const delta = positions.map((point, id) => {
    const target = fixed.get(id);
    return target === undefined
      ? [0, 0, 0]
      : target.map((value, axis) => value - point[axis]);
  });
  const free = [...visited]
    .filter((id) => !fixed.has(id))
    .sort((a, b) => a - b);
  // Gauss-Seidel uses a stable vertex order with at most 256 refinement sweeps.
  // The displacement residual can stop a converged field earlier.
  // Boundary positions are never averaged, preserving the part's exact seam.
  for (let iteration = 0; iteration < 256; iteration++) {
    let change = 0;
    for (const id of free) {
      const sum = [0, 0, 0];
      let weight = 0;
      for (const [near, distance] of neighbours[id]) {
        const w = 1 / Math.max(distance, 1e-6);
        weight += w;
        for (let axis = 0; axis < 3; axis++) sum[axis] += w * delta[near][axis];
      }
      for (let axis = 0; axis < 3; axis++) {
        const value = sum[axis] / weight;
        change = Math.max(change, Math.abs(value - delta[id][axis]));
        delta[id][axis] = value;
      }
    }
    if (change < 1e-9) break;
  }
  return positions.map(
    (point, id) =>
      fixed.get(id) ?? point.map((value, axis) => value + delta[id][axis]),
  );
}
