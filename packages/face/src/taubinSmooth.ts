/** Vertex adjacency + boundary classification of a triangle mesh. */
export interface IForgeAdjacency {
  /** Neighbor vertex indices per vertex. */
  adjacency: number[][];

  /** Whether each vertex lies on an open boundary (an edge used only once). */
  boundary: boolean[];
}

/**
 * Build vertex adjacency and boundary flags from triangle indices: the
 * structure {@link taubinSmooth} smooths over.
 *
 * An edge referenced by exactly one triangle is open; both its endpoints are
 * boundary vertices. Vertices the indices never reference stay neighborless
 * (and are left untouched by smoothing).
 *
 * @author Samchon
 */
export const meshAdjacency = (
  indices: number[],
  vertexCount: number,
): IForgeAdjacency => {
  const sets: Set<number>[] = Array.from(
    { length: vertexCount },
    () => new Set<number>(),
  );
  const edgeCount = new Map<number, number>();
  for (let t = 0; t < indices.length; t += 3) {
    const tri = [indices[t]!, indices[t + 1]!, indices[t + 2]!];
    for (let e = 0; e < 3; e++) {
      const a = tri[e]!;
      const b = tri[(e + 1) % 3]!;
      sets[a]!.add(b);
      sets[b]!.add(a);
      const key = Math.min(a, b) * vertexCount + Math.max(a, b);
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }
  const boundary = new Array<boolean>(vertexCount).fill(false);
  for (const [key, count] of edgeCount)
    if (count === 1) {
      boundary[(key / vertexCount) | 0] = true;
      boundary[key % vertexCount] = true;
    }
  return { adjacency: sets.map((s) => [...s]), boundary };
};

/** Options of {@link taubinSmooth}. */
export interface IForgeTaubinOptions {
  /** Λ|μ iteration pairs to run. Default `1`. */
  iterations?: number;

  /** Shrink step factor. Default `0.5`. */
  lambda?: number;

  /** Inflate step factor (negative). Default `-0.53`. */
  mu?: number;

  /**
   * Strength multiplier on boundary vertices, which are smoothed along the
   * boundary loop only (against interior neighbors they would shrink the
   * silhouette; fully pinned they keep their jitter). Default `0.6`.
   */
  boundaryFactor?: number;

  /**
   * Per-vertex strength in `[0, 1]`: protect features (eyelids, lip seam, nose
   * tip) by lowering theirs. Default: `1` everywhere.
   */
  weights?: number[];
}

/**
 * Taubin λ|μ mesh smoothing: noise removal without the shrinkage of plain
 * Laplacian passes, the cleanup that keeps detection jitter from reading as
 * lumpy clay.
 *
 * Interior vertices average over all neighbors; boundary vertices average over
 * boundary neighbors only, at reduced strength; vertices with fewer than two
 * usable neighbors are left untouched. Positions are flat xyz triples; a new
 * array is returned.
 *
 * @author Samchon
 */
export const taubinSmooth = (
  positions: number[],
  mesh: IForgeAdjacency,
  options: IForgeTaubinOptions = {},
): number[] => {
  const {
    iterations = 1,
    lambda = 0.5,
    mu = -0.53,
    boundaryFactor = 0.6,
    weights,
  } = options;
  const n = positions.length / 3;
  let current = positions.slice();
  for (let pass = 0; pass < iterations * 2; pass++) {
    const f = pass % 2 === 0 ? lambda : mu;
    const next = current.slice();
    for (let i = 0; i < n; i++) {
      const neighbors = mesh.boundary[i]
        ? mesh.adjacency[i]!.filter((j) => mesh.boundary[j])
        : mesh.adjacency[i]!;
      if (neighbors.length < 2) continue;
      const g =
        f * (mesh.boundary[i] ? boundaryFactor : 1) * (weights?.[i] ?? 1);
      for (let k = 0; k < 3; k++) {
        let avg = 0;
        for (const j of neighbors) avg += current[j * 3 + k]!;
        avg /= neighbors.length;
        next[i * 3 + k] = current[i * 3 + k]! + g * (avg - current[i * 3 + k]!);
      }
    }
    current = next;
  }
  return current;
};
