import type { IControlMesh } from "./subdivideControlMesh";

/**
 * Refine a joining surface without subdividing either attachment boundary.
 * Shared interior edges receive one midpoint used by both incident faces. Each
 * face adds its centroid and fans over the resulting perimeter. Thus an old
 * diagonal between two fixed seam vertices can bend after the fairing solve;
 * centroid-only splitting would leave that entire straight chord fixed.
 *
 * Positions use the cage's millimetre frame. Existing positions and triangles
 * are not moved; only new positions are appended and owned triangles returned.
 * One-face boundary edges remain exact. Rounds are integers from zero to four.
 */
export function refinePortraitJoin(
  cage: IControlMesh,
  input: readonly (readonly number[])[],
  rounds: number,
): number[][] {
  if (
    !Number.isInteger(rounds) ||
    rounds < 0 ||
    rounds > 4 ||
    input.some(
      (tri) =>
        tri.length !== 3 ||
        tri.some(
          (v) =>
            !Number.isInteger(v) ||
            v < 0 ||
            cage.positions[v] === undefined ||
            cage.positions[v].length !== 3 ||
            !cage.positions[v].every(Number.isFinite),
        ),
    )
  )
    throw new Error(
      "Join refinement needs resident finite triangles and zero through four rounds.",
    );
  const key = (a: number, b: number) => (a < b ? `${a}/${b}` : `${b}/${a}`);
  let triangles = input.map((tri) => [...tri]);
  for (let round = 0; round < rounds; round++) {
    const edges = new Map<
      string,
      { a: number; b: number; count: number; midpoint?: number }
    >();
    for (const tri of triangles)
      for (let i = 0; i < 3; i++) {
        const a = tri[i],
          b = tri[(i + 1) % 3],
          id = key(a, b),
          edge = edges.get(id);
        if (edge === undefined) edges.set(id, { a, b, count: 1 });
        else edge.count++;
      }
    if ([...edges.values()].some((edge) => edge.count > 2))
      throw new Error("Join refinement requires manifold edges.");
    for (const edge of edges.values())
      if (edge.count === 2) {
        edge.midpoint = cage.positions.length;
        cage.positions.push(
          cage.positions[edge.a].map(
            (v, k) => v / 2 + cage.positions[edge.b][k] / 2,
          ),
        );
      }
    triangles = triangles.flatMap((tri) => {
      const perimeter: number[] = [];
      for (let i = 0; i < 3; i++) {
        perimeter.push(tri[i]);
        const midpoint = edges.get(key(tri[i], tri[(i + 1) % 3]))!.midpoint;
        if (midpoint !== undefined) perimeter.push(midpoint);
      }
      const centre = cage.positions.length;
      cage.positions.push(
        [0, 1, 2].map((axis) =>
          tri.reduce((sum, v) => sum + cage.positions[v][axis] / 3, 0),
        ),
      );
      return perimeter.map((v, i) => [
        v,
        perimeter[(i + 1) % perimeter.length],
        centre,
      ]);
    });
  }
  return triangles;
}
