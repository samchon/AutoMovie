/**
 * Select the actual oral attachment from a refined, oriented skin surface.
 * oralLining calls this before constructing its interior depth rings. The seed
 * identifies one free cycle, including when a vermilion band has an outer edge.
 * Vertex indices and head-frame millimetre positions are caller-owned; only a
 * new ordered index array is returned. No spline estimates the attachment.
 *
 * Complete resident triangles, opposed manifold edges and unique outgoing
 * boundary edges establish disjoint cycles. Only then may the seed be followed
 * without a geometric proximity search. Finite, noncollapsed rim coordinates
 * are checked before a downstream enclosure copies them. This topology owner
 * does not establish clearance, tissue thickness or the enclosed cavity shape.
 * Changing its order or coordinates changes lining winding and seam identity.
 */

/**
 * Trace the seeded free skin cycle in its original edge orientation. An oral
 * enclosure reverses these edges when joining its inward-facing surface. The
 * opposite incident edges of every interior triangle cancel, so unique free
 * outgoing edges imply unique incoming edges and a closed boundary cycle.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Identifies the resident oral opening that an independently formed interior must join.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments Preserves the seeded refined boundary and rejects incomplete, branched, nonmanifold or collapsed attachment data.
 */
export function tracePortraitOralBoundary(
  surface: {
    positions: readonly (readonly number[])[];
    indices: readonly number[];
  },
  seed: number,
): number[] {
  if (
    surface.indices.length % 3 !== 0 ||
    surface.indices.some(
      (id) => !Number.isInteger(id) || id < 0 || id >= surface.positions.length,
    )
  )
    throw new Error("Oral lining needs resident complete skin triangles.");
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < surface.indices.length; i += 3) {
    const face = surface.indices.slice(i, i + 3);
    if (new Set(face).size !== 3)
      throw new Error("Oral lining skin triangles need distinct vertices.");
    for (let j = 0; j < 3; j++) {
      const a = face[j],
        b = face[(j + 1) % 3];
      const key = `${Math.min(a, b)}/${Math.max(a, b)}`;
      const edge = edges.get(key);
      if (edge === undefined) edges.set(key, { a, b, count: 1 });
      else {
        if (edge.count === 2 || edge.a === a)
          throw new Error(
            "Oral lining skin must have manifold, opposed edges.",
          );
        edge.count++;
      }
    }
  }
  const next = new Map<number, number>();
  for (const edge of edges.values())
    if (edge.count === 1) {
      if (next.has(edge.a))
        throw new Error("Oral lining skin boundary must not branch.");
      next.set(edge.a, edge.b);
    }
  if (!next.has(seed))
    throw new Error("Oral lining seed must lie on a free skin boundary.");
  const boundary = [seed];
  for (let id = next.get(seed)!; id !== seed; id = next.get(id)!)
    boundary.push(id);
  const rim = boundary.map((id) => surface.positions[id]);
  if (rim.some((p) => p.length !== 3 || !p.every(Number.isFinite)))
    throw new Error("Oral lining rim must contain finite XYZ points.");
  for (let i = 0; i < rim.length; i++)
    if (rim[i].every((v, axis) => v === rim[(i + 1) % rim.length][axis]))
      throw new Error("Oral lining rim edges must have positive length.");
  return boundary;
}
