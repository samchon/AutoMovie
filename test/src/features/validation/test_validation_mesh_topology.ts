import { tessellateToMesh, validateMeshTopology } from "@automovie/engine";
import { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, violationCount } from "../internal/predicates";

const mesh = (
  positions: number[],
  indices: number[] | null,
): IAutoMovieMesh => ({
  positions,
  normals: null,
  uvs: null,
  indices,
  skin: null,
});

/** Four distinct vertices of a unit square (z=0) plus spares for extra fins. */
const P = [
  0,
  0,
  0, // v0
  1,
  0,
  0, // v1
  0,
  1,
  0, // v2
  1,
  1,
  0, // v3
  0,
  0,
  1, // v4 (out of plane, for a third fin)
];

const topo = (m: IAutoMovieMesh, expectClosed = false) =>
  validateMeshTopology({ mesh: m, expectClosed });

/**
 * The Tier-5 mesh-topology validator (#1183): the `"topology"` violation kind
 * was codified but never emitted. It welds vertices and enforces the two
 * invariants every valid triangle mesh must satisfy — 2-manifold (no edge on
 * more than two triangles) and consistent winding (adjacent triangles traverse
 * a shared edge oppositely) — as errors, with an opt-in watertight check.
 * Tessellated primitives pass by construction; the target is externally-sourced
 * or hand-built mesh geometry validated through `validateModel`.
 *
 * Scenarios:
 *
 * 1. Two triangles sharing an edge with consistent winding pass; the same open
 *    surface under `expectClosed` reports its boundary edges as errors.
 * 2. A third triangle on one edge (a fin) is a non-manifold `topology` error.
 * 3. Two triangles winding a shared edge the SAME way is a winding `topology`
 *    error, even though the edge is only 2-incident.
 * 4. A degenerate triangle (a repeated welded vertex) carries no surface and is
 *    skipped, not errored.
 * 5. A non-indexed single triangle (indices null → sequential) passes.
 * 6. Malformed buffers (empty, out-of-range index, ragged index/position count)
 *    yield no topology verdict — the structural report is `validateModel`'s
 *    job.
 * 7. A closed manifold (a tetrahedron: every edge shared by exactly two
 *    outward-wound faces) PASSES `expectClosed` — the non-firing twin of
 *    scenario 1's open-surface failure, so an over-matching boundary detector
 *    could not hide behind the absence of a watertight-passes case.
 * 8. That same tetrahedron with one face removed reports its three now-open
 *    boundary edges under `expectClosed` — pinning the watertight check to fire
 *    only on genuine boundaries.
 */
export const test_validation_mesh_topology = (): void => {
  // 1. consistent open pair — passes; expectClosed flags its open edges.
  const openPair = mesh(P.slice(0, 12), [0, 1, 2, 1, 3, 2]);
  TestValidator.equals("a consistent open pair passes", topo(openPair), {
    success: true,
  });
  TestValidator.predicate(
    "under expectClosed, an open edge is a topology error",
    hasViolation(topo(openPair, true), "topology", "$input.indices") &&
      topo(openPair, true).success === false,
  );

  // 2. a fin: three triangles share edge 0–1 → non-manifold.
  const fin = mesh(P, [0, 1, 2, 1, 0, 3, 0, 1, 4]);
  const finResult = topo(fin);
  TestValidator.predicate(
    "a third triangle on one edge is a non-manifold error",
    finResult.success === false &&
      hasViolation(finResult, "topology", "$input.indices") &&
      finResult.violations.some((v) => v.expected.includes("2-manifold")),
  );

  // 3. two triangles winding edge 0–1 the same way → flipped.
  const flipped = mesh(P.slice(0, 12), [0, 1, 2, 0, 1, 3]);
  const flippedResult = topo(flipped);
  TestValidator.predicate(
    "two triangles winding a shared edge alike is a winding error",
    flippedResult.success === false &&
      flippedResult.violations.some((v) => v.expected.includes("flipped")),
  );

  // 4. a degenerate triangle (v3 repeated) carries no surface — skipped.
  const degenerate = mesh(P, [0, 1, 2, 3, 3, 4]);
  TestValidator.equals(
    "a degenerate triangle is skipped, not errored",
    topo(degenerate),
    { success: true },
  );

  // 5. non-indexed single triangle; defaults (no path, no expectClosed) hold.
  const soup = mesh(P.slice(0, 9), null);
  TestValidator.equals(
    "a non-indexed single triangle passes with defaults",
    validateMeshTopology({ mesh: soup }),
    { success: true },
  );
  TestValidator.predicate(
    "an explicit path roots the violation",
    hasViolation(
      validateMeshTopology({ mesh: fin, path: "$mesh" }),
      "topology",
      "$mesh.indices",
    ),
  );

  // 6. malformed buffers yield no topology verdict (validateModel reports them).
  TestValidator.equals(
    "empty positions yield no topology verdict",
    topo(mesh([], [])),
    { success: true },
  );
  TestValidator.equals(
    "an out-of-range index yields no topology verdict",
    topo(mesh(P.slice(0, 9), [0, 1, 9])),
    { success: true },
  );
  TestValidator.equals(
    "a negative index yields no topology verdict",
    topo(mesh(P.slice(0, 9), [0, 1, -1])),
    { success: true },
  );
  TestValidator.equals(
    "a non-integer index yields no topology verdict",
    topo(mesh(P.slice(0, 9), [0, 1, 1.5])),
    { success: true },
  );
  TestValidator.equals(
    "a ragged index count yields no topology verdict",
    topo(mesh(P.slice(0, 9), [0, 1])),
    { success: true },
  );
  TestValidator.equals(
    "a ragged position buffer yields no topology verdict",
    topo(mesh([0, 0, 0, 1], null)),
    { success: true },
  );

  // 7. a closed manifold passes expectClosed (the watertight non-firing twin).
  // Tetrahedron on v0(0,0,0) v1(1,0,0) v2(0,1,0) v3(0,0,1); the four faces are
  // wound outward so every one of the six edges is shared by exactly two faces
  // traversing it oppositely (2-manifold, consistent winding, watertight).
  const TETRA = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
  const closedTetra = mesh(TETRA, [
    0,
    2,
    1, // face opposite v3
    0,
    1,
    3, // face opposite v2
    0,
    3,
    2, // face opposite v1
    1,
    2,
    3, // face opposite v0
  ]);
  TestValidator.equals(
    "a closed manifold passes without expectClosed",
    topo(closedTetra),
    { success: true },
  );
  TestValidator.equals(
    "a closed manifold passes UNDER expectClosed (watertight)",
    topo(closedTetra, true),
    { success: true },
  );

  // 8. the same tetrahedron minus one face exposes exactly its three open edges
  const openTetra = mesh(TETRA, [0, 2, 1, 0, 1, 3, 0, 3, 2]);
  TestValidator.equals(
    "an open tetra passes without expectClosed",
    topo(openTetra),
    { success: true },
  );
  const openTetraClosed = topo(openTetra, true);
  TestValidator.equals(
    "an open tetra fails under expectClosed",
    openTetraClosed.success,
    false,
  );
  TestValidator.predicate(
    "the watertight check reports the open boundary as a topology error",
    hasViolation(openTetraClosed, "topology", "$input.indices"),
  );
  // The removed face exposes exactly its three edges, so the check must report
  // three boundary edges — not merely "at least one" (a single collapsed
  // violation would still satisfy `hasViolation`).
  TestValidator.equals(
    "each of the three open edges is reported once",
    violationCount(openTetraClosed),
    3,
  );

  // 9. a tessellated box is per-face geometry: its eight corners are emitted
  // three times each (once per adjoining face), so it is watertight ONLY after
  // the topology check welds coincident positions. Passing `expectClosed`
  // exercises WELD_GRID on a genuine seam — the merge's real purpose — where the
  // hand-built fixtures above already share their vertex indices.
  const weldedBox = tessellateToMesh({
    type: "box",
    width: 1,
    height: 1,
    depth: 1,
  });
  TestValidator.predicate(
    "the box carries duplicated corners the weld must merge",
    weldedBox.positions.length / 3 > 8,
  );
  TestValidator.equals(
    "a tessellated box is watertight once coincident corners weld",
    topo(weldedBox, true),
    { success: true },
  );
};
