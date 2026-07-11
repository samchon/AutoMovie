import { IAutoMovieMesh, IAutoMovieValidation } from "@automovie/interface";

import { ViolationCollector } from "./violation";

/** Weld tolerance: ring seams recompute cos/sin with ~1e-16 float error. */
const WELD_GRID = 1e9;

/**
 * Validate a mesh's Tier-5 topology (the codified `"topology"` violation kind,
 * previously declared but never emitted). It welds vertices by position and
 * checks the two invariants EVERY valid triangle mesh must satisfy, regardless
 * of whether it is a closed solid or an open surface:
 *
 * - **2-manifold:** no edge is shared by more than two triangles (a "fin" — a
 *   third face growing out of an edge — cannot bound a surface).
 * - **Consistent winding:** two triangles adjacent on an edge traverse it in
 *   opposite directions, so their outward faces agree (the glTF front-face
 *   contract a renderer culls against).
 *
 * These are ERRORS — a mesh violating them is structurally broken, not merely
 * implausible. **Watertightness** (no boundary/open edges) is context-dependent
 * — a plane, decal, or cloth is a legitimate open mesh — so it is only checked
 * when the caller sets `expectClosed` (a baked solid, a collision proxy).
 *
 * The check assumes structurally-valid buffers (positions a multiple of 3,
 * indices whole triangles in range); on malformed input it returns without a
 * topology verdict, leaving the structural report to {@link validateModel}'s
 * mesh checks. Tessellated primitives are watertight by construction and pass;
 * the beneficiary is externally-sourced or hand-built mesh geometry validated
 * through `validateModel` or the MCP `validateModel` tool.
 *
 * @author Samchon
 */
export const validateMeshTopology = (props: {
  /** Mesh to check. */
  mesh: IAutoMovieMesh;

  /** JSON path of the mesh being checked. Defaults to `$input`. */
  path?: string;

  /** When set, a boundary (open) edge is also an error — the mesh must close. */
  expectClosed?: boolean;
}): IAutoMovieValidation => {
  const collector = new ViolationCollector();
  appendMeshTopology(
    props.mesh,
    props.path ?? "$input",
    collector,
    props.expectClosed ?? false,
  );
  return collector.toValidation();
};

/**
 * Append mesh-topology violations to a collector — the shared body behind the
 * standalone {@link validateMeshTopology} and `validateModel`'s mesh check.
 */
export const appendMeshTopology = (
  mesh: IAutoMovieMesh,
  path: string,
  collector: ViolationCollector,
  expectClosed: boolean,
): void => {
  const vertexCount = mesh.positions.length / 3;
  if (vertexCount === 0 || !Number.isInteger(vertexCount)) return;
  const indices =
    mesh.indices ?? Array.from({ length: vertexCount }, (_, i) => i);
  if (indices.length % 3 !== 0) return;
  if (
    indices.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= vertexCount,
    )
  )
    return;

  const keyOf = (vertex: number): string =>
    [0, 1, 2]
      .map(
        (axis) =>
          Math.round(mesh.positions[vertex * 3 + axis]! * WELD_GRID) || 0,
      )
      .join(",");

  // Undirected edge → incident-triangle count (manifoldness); directed edge →
  // count in that traversal direction (winding consistency).
  const undirected = new Map<string, number>();
  const directed = new Map<string, number>();
  for (let i = 0; i < indices.length; i += 3) {
    const keys = [indices[i]!, indices[i + 1]!, indices[i + 2]!].map(keyOf);
    // A triangle with a repeated welded vertex (a pole ring, a collapsed cap)
    // carries no surface — skip it, exactly as the watertightness oracle does.
    if (new Set(keys).size < 3) continue;
    for (let e = 0; e < 3; ++e) {
      const from = keys[e]!;
      const to = keys[(e + 1) % 3]!;
      directed.set(`${from}|${to}`, (directed.get(`${from}|${to}`) ?? 0) + 1);
      const edge = [from, to].sort((a, b) => a.localeCompare(b)).join("|");
      undirected.set(edge, (undirected.get(edge) ?? 0) + 1);
    }
  }

  for (const [edge, count] of undirected)
    if (count > 2)
      collector.push(
        "topology",
        `${path}.indices`,
        `a 2-manifold mesh edge is shared by at most 2 triangles, but the edge (${edge}) is shared by ${count}`,
        count,
      );

  for (const [edge, count] of directed)
    if (count > 1)
      collector.push(
        "topology",
        `${path}.indices`,
        `triangles adjacent on an edge must wind in opposite directions, but the directed edge (${edge}) appears ${count} times (a flipped triangle)`,
        count,
      );

  if (expectClosed)
    for (const [edge, count] of undirected)
      if (count === 1)
        collector.push(
          "topology",
          `${path}.indices`,
          `a closed mesh has every edge shared by 2 triangles, but the edge (${edge}) is a boundary (open) edge`,
          edge,
        );
};
