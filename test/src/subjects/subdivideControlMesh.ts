/**
 * A triangle control cage with one material label per face.
 *
 * @author Samchon
 */
export interface IControlMesh {
  /** XYZ control vertices in the caller's coordinate unit, millimetres here. */
  positions: number[][];
  /** Oriented triangle triples referencing positions, with manifold adjacency. */
  indices: number[];
  /** One opaque material-region label per triangle, inherited by all children. */
  groups: number[];
}

/** Loop subdivision preserving shared edges, boundary curves and face labels. */
export function subdivideControlMesh(
  input: IControlMesh,
  rounds: number,
): IControlMesh {
  let mesh = input;
  for (let round = 0; round < rounds; round++) {
    const neighbours = mesh.positions.map(() => new Set<number>());
    const boundary = mesh.positions.map(() => new Set<number>());
    const edges = new Map<
      string,
      { a: number; b: number; opposite: number[]; index: number }
    >();
    const key = (a: number, b: number): string =>
      a < b ? `${a}/${b}` : `${b}/${a}`;
    // Face corners retain their edge identities for the refinement pass. This
    // avoids rebuilding the same string keys and looking up every edge twice.
    const triangleEdges: number[] = [];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        const a = mesh.indices[i + j];
        const b = mesh.indices[i + ((j + 1) % 3)];
        const c = mesh.indices[i + ((j + 2) % 3)];
        neighbours[a].add(b);
        neighbours[b].add(a);
        const id = key(a, b);
        let edge = edges.get(id);
        if (edge === undefined) {
          edge = {
            a,
            b,
            opposite: [],
            index: mesh.positions.length + edges.size,
          };
          edges.set(id, edge);
        }
        edge.opposite.push(c);
        triangleEdges.push(edge.index);
      }
    }
    for (const edge of edges.values())
      if (edge.opposite.length === 1) {
        boundary[edge.a].add(edge.b);
        boundary[edge.b].add(edge.a);
      }
    const positions = mesh.positions.map((point, i) => {
      if (boundary[i].size !== 0)
        return point.map(
          (value, axis) =>
            0.75 * value +
            0.125 *
              [...boundary[i]].reduce(
                (sum, next) => sum + mesh.positions[next][axis],
                0,
              ),
        );
      const count = neighbours[i].size;
      if (count === 0) return [...point];
      const beta = count === 3 ? 3 / 16 : 3 / (8 * count);
      return point.map(
        (value, axis) =>
          (1 - count * beta) * value +
          beta *
            [...neighbours[i]].reduce(
              (sum, next) => sum + mesh.positions[next][axis],
              0,
            ),
      );
    });
    for (const edge of edges.values())
      positions.push(
        mesh.positions[edge.a].map((a, axis) =>
          edge.opposite.length === 1
            ? (a + mesh.positions[edge.b][axis]) / 2
            : (a + mesh.positions[edge.b][axis]) * 0.375 +
              edge.opposite.reduce(
                (sum, next) => sum + mesh.positions[next][axis],
                0,
              ) *
                0.125,
        ),
      );
    const indices: number[] = [];
    const groups: number[] = [];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const a = mesh.indices[i],
        b = mesh.indices[i + 1],
        c = mesh.indices[i + 2];
      const ab = triangleEdges[i],
        bc = triangleEdges[i + 1],
        ca = triangleEdges[i + 2];
      indices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      const group = mesh.groups[i / 3];
      groups.push(group, group, group, group);
    }
    mesh = { positions, indices, groups };
  }
  return mesh;
}
