/**
 * Select the connected triangle patch on the inward side of an oriented mesh
 * boundary. A boundary follows the selected faces' winding and lists each
 * vertex once. Selection uses connectivity, so a pose or a folded projection
 * cannot turn a complete anatomical opening into a partly removed patch.
 *
 * The input must have consistently wound manifold edges. A nonseparating loop
 * is refused. On an open surface, the selected patch cannot reach an original
 * free edge outside the supplied boundary. Returned values are sorted original
 * triangle ordinals, suitable for subsequent removal without renumbering.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Selects a boundary-delimited source patch as a reusable topology operation, independent of the coordinates into which its mesh is deformed.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Enforces manifold winding and a separating boundary before returning stable original triangle identities for mesh composition.
 * @author Samchon
 */
export function selectAutoMovieTriangleRegion(props: {
  indices: readonly number[];
  boundary: readonly number[];
}): number[] {
  const { indices, boundary } = props;
  if (
    indices.length % 3 !== 0 ||
    boundary.length < 3 ||
    new Set(boundary).size !== boundary.length ||
    [...indices, ...boundary].some(
      (index) => !Number.isInteger(index) || index < 0,
    )
  )
    throw new Error(
      "A triangle region needs complete triangles and distinct nonnegative boundary vertices.",
    );
  const key = (a: number, b: number): string =>
    Math.min(a, b) + "/" + Math.max(a, b);
  const barriers = new Set(
    boundary.map((a, i) => key(a, boundary[(i + 1) % boundary.length])),
  );
  const edges = new Map<string, { triangle: number; a: number; b: number }[]>();
  const triangleEdges: string[][] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const face = indices.slice(i, i + 3);
    if (new Set(face).size !== 3)
      throw new Error(
        "A region source triangle must have three distinct vertices.",
      );
    const identities = [];
    for (let j = 0; j < 3; j++) {
      const a = face[j],
        b = face[(j + 1) % 3],
        identity = key(a, b);
      identities.push(identity);
      const incident = edges.get(identity) ?? [];
      if (incident.length === 2 || incident.some((edge) => edge.a === a))
        throw new Error(
          "A region source must have consistently wound manifold edges.",
        );
      incident.push({ triangle: i / 3, a, b });
      edges.set(identity, incident);
    }
    triangleEdges.push(identities);
  }
  const seeds: number[] = [];
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length];
    const incident = edges.get(key(a, b));
    const inward = incident?.find((edge) => edge.a === a && edge.b === b);
    if (inward === undefined)
      throw new Error(
        "Every oriented region boundary edge must belong to its selected surface.",
      );
    seeds.push(inward.triangle);
  }
  const selected = new Set<number>();
  const pending = [...seeds];
  for (let i = 0; i < pending.length; i++) {
    const triangle = pending[i];
    if (selected.has(triangle)) continue;
    selected.add(triangle);
    for (const identity of triangleEdges[triangle]) {
      if (barriers.has(identity)) continue;
      const incident = edges.get(identity)!;
      if (incident.length === 1)
        throw new Error(
          "A region boundary must not select an outside free edge.",
        );
      for (const neighbour of incident)
        if (!selected.has(neighbour.triangle)) pending.push(neighbour.triangle);
    }
  }
  for (const identity of barriers)
    if (
      edges.get(identity)!.filter((edge) => selected.has(edge.triangle))
        .length !== 1
    )
      throw new Error(
        "A region boundary must separate one connected surface patch.",
      );
  return [...selected].sort((a, b) => a - b);
}
