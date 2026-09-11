import type { IControlMesh } from "./subdivideControlMesh";

/**
 * A composed skin may have declared anatomical openings, but no accidental
 * cracks, missing stitches or oppositely assembled component faces. Audit the
 * shared control cage before subdivision could multiply a broken attachment.
 */
export function assertPortraitSkinTopology(
  cage: IControlMesh,
  openings: number[][],
): void {
  const key = (a: number, b: number): string =>
    Math.min(a, b) + "/" + Math.max(a, b);
  const expected = new Set<string>();
  for (const loop of openings) {
    if (loop.length < 3 || new Set(loop).size !== loop.length)
      throw new Error(
        "A declared skin opening needs at least three distinct boundary vertices.",
      );
    for (let i = 0; i < loop.length; i++) {
      const id = key(loop[i], loop[(i + 1) % loop.length]);
      if (expected.has(id))
        throw new Error("Two components declare the same open skin edge.");
      expected.add(id);
    }
  }
  const edges = new Map<string, { count: number; direction: number }>();
  for (let i = 0; i < cage.indices.length; i += 3)
    for (let corner = 0; corner < 3; corner++) {
      const a = cage.indices[i + corner],
        b = cage.indices[i + ((corner + 1) % 3)];
      if (
        !Number.isInteger(a) ||
        a < 0 ||
        a >= cage.positions.length ||
        a === b
      )
        throw new Error(
          "A skin triangle needs distinct resident vertex identities.",
        );
      const id = key(a, b),
        edge = edges.get(id) ?? { count: 0, direction: 0 };
      edge.count++;
      edge.direction += a < b ? 1 : -1;
      edges.set(id, edge);
    }
  for (const [id, edge] of edges) {
    if (edge.count === 1) {
      if (!expected.delete(id))
        throw new Error("A component left an undeclared opening in the skin.");
    } else if (edge.count !== 2 || edge.direction !== 0)
      throw new Error(
        "Attached skin edges need two oppositely wound incident faces.",
      );
  }
  if (expected.size !== 0)
    throw new Error(
      "A declared skin opening is not present in the assembled surface.",
    );
}
