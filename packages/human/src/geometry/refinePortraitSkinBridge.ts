/**
 * Retriangulate a skin annulus after adding original-surface interior samples.
 * Boundary edges are retained. Interior diagonals use the planar Delaunay test
 * so the inserted samples do not remain three-valence triangle fans. All input
 * triangles form a non-overlapping manifold, counterclockwise in the admitted
 * XY attachment chart. The caller owns that annulus admission. Incomplete,
 * nonfinite or numerically degenerate triangles are refused here.
 * Positions are head millimetres; the caller provides the original skin query.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement Retains sampled host curvature inside a replacement seam rather than discarding every interior skin witness.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Preserves annulus boundaries while redistributing interior edges around original-surface samples before common subdivision.
 */
export function refinePortraitSkinBridge(
  input: readonly (readonly number[])[],
  indices: readonly number[],
  depth: (x: number, y: number) => number,
): { positions: number[][]; indices: number[] } {
  if (
    input.some((p) => p.length !== 3 || !p.every(Number.isFinite)) ||
    indices.length % 3 !== 0 ||
    indices.some((id) => !Number.isInteger(id) || id < 0 || id >= input.length)
  )
    throw new Error(
      "Skin bridge needs finite XYZ vertices and complete valid triangle indices.",
    );
  const positions = input.map((p) => [...p]);
  const scale =
    input.reduce(
      (maximum, p) => Math.max(maximum, Math.abs(p[0]), Math.abs(p[1])),
      0,
    ) || 1;
  const chart = input.map((p) => [p[0] / scale, p[1] / scale]);
  const area = (a: number, b: number, c: number) =>
    (chart[b][0] - chart[a][0]) * (chart[c][1] - chart[a][1]) -
    (chart[b][1] - chart[a][1]) * (chart[c][0] - chart[a][0]);
  const faces: number[][] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const face = indices.slice(i, i + 3);
    if (area(face[0], face[1], face[2]) <= 0)
      throw new Error(
        "Skin bridge needs counterclockwise nondegenerate XY triangles.",
      );
    const x = face.reduce((sum, id) => sum + positions[id][0] / 3, 0);
    const y = face.reduce((sum, id) => sum + positions[id][1] / 3, 0);
    const z = depth(x, y);
    if (!Number.isFinite(z))
      throw new Error(
        "Skin bridge samples need finite original-surface depth.",
      );
    const center = positions.push([x, y, z]) - 1;
    chart.push([x / scale, y / scale]);
    for (let edge = 0; edge < 3; edge++) {
      if (area(face[edge], face[(edge + 1) % 3], center) <= 0)
        throw new Error(
          "Skin bridge interior samples need representable XY positions.",
        );
      faces.push([face[edge], face[(edge + 1) % 3], center]);
    }
  }
  // A pass rebuilds adjacency after flips, never using an edge record whose
  // incident face has already changed. Strict positive improvement excludes
  // cocircular oscillation. Every accepted Lawson flip improves the planar
  // triangulation; a complete pass without an eligible flip is the fixed point.
  for (;;) {
    const edges = new Map<
      string,
      { face: number; a: number; b: number; c: number }[]
    >();
    for (let f = 0; f < faces.length; f++)
      for (let e = 0; e < 3; e++) {
        const [a, b, c] = [
          faces[f][e],
          faces[f][(e + 1) % 3],
          faces[f][(e + 2) % 3],
        ];
        const key = a < b ? `${a}/${b}` : `${b}/${a}`;
        const edge = edges.get(key) ?? [];
        edge.push({ face: f, a, b, c });
        edges.set(key, edge);
      }
    const touched = new Set<number>();
    let changed = false;
    for (const edge of edges.values()) {
      if (edge.length !== 2 || edge.some((e) => touched.has(e.face))) continue;
      const { a, b, c } = edge[0],
        d = edge[1].c;
      if (area(c, d, b) <= 0 || area(d, c, a) <= 0) continue;
      const delta = [a, b, c].map((id) => [
        chart[id][0] - chart[d][0],
        chart[id][1] - chart[d][1],
      ]);
      const extent = Math.max(...delta.flat().map(Math.abs));
      const q = delta.map((p) => p.map((v) => v / extent));
      const [u, v, w] = q,
        sq = (p: number[]) => p[0] * p[0] + p[1] * p[1];
      const determinant =
        sq(u) * (v[0] * w[1] - v[1] * w[0]) -
        sq(v) * (u[0] * w[1] - u[1] * w[0]) +
        sq(w) * (u[0] * v[1] - u[1] * v[0]);
      const radiusSquared = Math.max(...q.map(sq));
      if (determinant <= 1e-12 * radiusSquared * radiusSquared) continue;
      faces[edge[0].face] = [c, d, b];
      faces[edge[1].face] = [d, c, a];
      edge.forEach((e) => touched.add(e.face));
      changed = true;
    }
    if (!changed) return { positions, indices: faces.flat() };
  }
}
