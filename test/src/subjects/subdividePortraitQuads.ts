/**
 * A connected quadrilateral skin cage. Distances retain the caller's units.
 * Material groups belong to faces and inherit through refinement.
 * @author Samchon
 */
export interface IPortraitQuadMesh {
  positions: number[][];
  faces: number[][];
  groups: number[];
}

/**
 * Catmull-Clark refinement of a manifold quad cage. Face and edge points are
 * shared by identity. Boundary vertices use the cubic boundary rule; interior
 * vertices use adjacent face averages and edge midpoints. Zero rounds retains
 * the input, while refinement owns its output and does not modify the cage.
 */
export function subdividePortraitQuads(
  input: IPortraitQuadMesh,
  rounds: number,
): IPortraitQuadMesh {
  if (
    !Number.isInteger(rounds) ||
    rounds < 0 ||
    rounds > 3 ||
    input.groups.length !== input.faces.length ||
    input.positions.some((p) => p.length !== 3 || !p.every(Number.isFinite)) ||
    input.faces.some(
      (f) =>
        f.length !== 4 ||
        new Set(f).size !== 4 ||
        f.some(
          (i) => !Number.isInteger(i) || i < 0 || i >= input.positions.length,
        ),
    )
  )
    throw new Error(
      "Quad refinement needs finite resident quads, face labels and zero through three rounds.",
    );
  let mesh = input;
  for (let round = 0; round < rounds; round++) {
    // The rules are affine in each coordinate. Evaluate in bounded per-axis
    // coordinates, then restore the input units; this avoids overflowing sums
    // when a caller uses large finite coordinates for the same cage.
    const scale = [0, 0, 0];
    for (const point of mesh.positions)
      for (let axis = 0; axis < 3; axis++)
        scale[axis] = Math.max(scale[axis], Math.abs(point[axis]));
    for (let axis = 0; axis < 3; axis++) scale[axis] ||= 1;
    const normalized = mesh.positions.map((p) => p.map((v, a) => v / scale[a]));
    const low = [Infinity, Infinity, Infinity],
      high = [-Infinity, -Infinity, -Infinity];
    for (const point of normalized)
      for (let a = 0; a < 3; a++) {
        low[a] = Math.min(low[a], point[a]);
        high[a] = Math.max(high[a], point[a]);
      }
    mesh = { ...mesh, positions: normalized };
    const edges = new Map<
      string,
      { a: number; b: number; faces: number[]; direction: number; id: number }
    >();
    const facesAt = mesh.positions.map(() => [] as number[]),
      edgesAt = mesh.positions.map(() => [] as number[]);
    const edgeKeys: string[][] = [];
    // Q_f is the arithmetic centre of each original quad. Divide each term
    // before summing so four large finite coordinates cannot overflow first.
    const facePoints = mesh.faces.map((f) =>
      [0, 1, 2].map((a) => f.reduce((s, i) => s + mesh.positions[i][a] / 4, 0)),
    );
    for (let face = 0; face < mesh.faces.length; face++) {
      const ids = mesh.faces[face],
        keys: string[] = [];
      for (let i = 0; i < 4; i++) {
        const a = ids[i],
          b = ids[(i + 1) % 4],
          key = Math.min(a, b) + "/" + Math.max(a, b);
        let edge = edges.get(key);
        if (edge === undefined) {
          edge = {
            a,
            b,
            faces: [],
            direction: 0,
            id: mesh.positions.length + edges.size,
          };
          edges.set(key, edge);
          edgesAt[a].push(edge.id);
          edgesAt[b].push(edge.id);
        }
        edge.faces.push(face);
        edge.direction += a < b ? 1 : -1;
        keys.push(key);
        facesAt[a].push(face);
      }
      edgeKeys.push(keys);
    }
    const list = [...edges.values()];
    if (
      list.some(
        (e) =>
          e.faces.length > 2 || (e.faces.length === 2 && e.direction !== 0),
      )
    )
      throw new Error(
        "Quad edges must have consistently wound manifold adjacency.",
      );
    const boundary = mesh.positions.map(() => [] as number[]);
    for (const e of list)
      if (e.faces.length === 1) {
        boundary[e.a].push(e.b);
        boundary[e.b].push(e.a);
      }
    if (
      boundary.some(
        (neighbours) => neighbours.length !== 0 && neighbours.length !== 2,
      )
    )
      throw new Error("Quad boundary vertices need two boundary neighbours.");
    const positions = mesh.positions.map((point, id) => {
      // A boundary follows its two boundary neighbours, not the adjacent face
      // average: P' = 3P/4 + (P_prev + P_next)/8. Units stay unchanged.
      if (boundary[id].length === 2)
        return point.map(
          (v, a) =>
            0.75 * v +
            0.125 * mesh.positions[boundary[id][0]][a] +
            0.125 * mesh.positions[boundary[id][1]][a],
        );
      const n = facesAt[id].length;
      if (n === 0) return [...point];
      return point.map((v, a) => {
        // For an interior vertex, n is its incident-face count, F is the mean
        // face centre and R is the mean ORIGINAL edge midpoint. The rule is
        // P'=(F+2R+(n-3)P)/n. New edge points must not be substituted for R.
        const f = facesAt[id].reduce((s, i) => s + facePoints[i][a] / n, 0);
        const neighbours = edgesAt[id].reduce((s, i) => {
          const e = list[i - mesh.positions.length];
          return (
            s + mesh.positions[e.a === id ? e.b : e.a][a] / edgesAt[id].length
          );
        }, 0);
        // 2R=P+mean(neighbours), so this equivalent form has nonnegative
        // weights even at valence two and avoids a subtractive large term.
        return f / n + neighbours / n + (1 - 2 / n) * v;
      });
    });
    // A boundary edge bisects its endpoints. An interior edge averages its
    // endpoints and the centres of its two incident faces, each with weight 1/4.
    for (const edge of list)
      positions.push(
        [0, 1, 2].map((a) =>
          edge.faces.length === 1
            ? mesh.positions[edge.a][a] / 2 + mesh.positions[edge.b][a] / 2
            : mesh.positions[edge.a][a] / 4 +
              mesh.positions[edge.b][a] / 4 +
              facePoints[edge.faces[0]][a] / 4 +
              facePoints[edge.faces[1]][a] / 4,
        ),
      );
    const faceStart = positions.length;
    positions.push(...facePoints);
    const faces: number[][] = [],
      groups: number[] = [];
    for (let face = 0; face < mesh.faces.length; face++)
      for (let i = 0; i < 4; i++) {
        faces.push([
          mesh.faces[face][i],
          edges.get(edgeKeys[face][i])!.id,
          faceStart + face,
          edges.get(edgeKeys[face][(i + 3) % 4])!.id,
        ]);
        groups.push(mesh.groups[face]);
      }
    // Every valid rule is a convex coordinate combination. Clamp only possible
    // floating round-off beyond the source extrema before restoring units.
    mesh = {
      positions: positions.map((p) =>
        p.map((v, a) => Math.max(low[a], Math.min(high[a], v)) * scale[a]),
      ),
      faces,
      groups,
    };
  }
  return mesh;
}
