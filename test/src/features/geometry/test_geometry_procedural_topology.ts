import {
  IAutoMovieMeshTopology,
  buildAutoMoviePolyhedron,
  buildAutoMovieWall,
  extrudeAutoMovieProfile,
  inspectAutoMovieMeshTopology,
  transformAutoMovieMesh,
} from "@automovie/engine";
import { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

const meshOf = (
  positions: number[],
  indices: number[] | null,
): IAutoMovieMesh => ({
  positions,
  normals: null,
  uvs: null,
  indices,
  skin: null,
});

/** The subset of a topology report a scenario names, kept in one spelling. */
const summary = (
  mesh: IAutoMovieMesh,
  keys: ReadonlyArray<keyof IAutoMovieMeshTopology>,
): Record<string, number | boolean> => {
  const report = inspectAutoMovieMeshTopology(mesh);
  return Object.fromEntries(keys.map((key) => [key, report[key]]));
};

/**
 * A closed solid must be provably closed, and an assembly must not be able to
 * pass as one.
 *
 * Nothing in this kernel is allowed to claim watertightness it did not earn, so
 * the check is the 2-manifold oracle: weld vertices by position, then demand
 * that every non-degenerate edge is used by exactly two triangles. That single
 * measure separates the three cases a builder actually produces — a closed
 * prism, an intentionally open surface, and members that share a face — and the
 * divergence-theorem volume is the independent second witness, exact for a
 * closed polyhedron and zero for a flat patch.
 *
 * Scenarios:
 *
 * 1. An extruded prism and a face-authored ridged solid are both watertight, with
 *    volumes equal to their hand-computed `w·h·d` and `w·h·d/2`.
 * 2. A single triangle is an open surface: three boundary edges, not watertight,
 *    zero volume.
 * 3. Three triangles sharing one edge report that edge as non-manifold, and a wall
 *    cut into cells that share faces reports the same rather than passing as a
 *    solid.
 * 4. A collapsed triangle is counted as degenerate and contributes no edges.
 * 5. Non-finite positions, normals, and uvs are all counted; an attribute-free
 *    mesh counts none of them.
 * 6. Corners spelled a picosecond of a metre apart weld into one, so a builder
 *    that recomputes a seam is still closed.
 * 7. An empty mesh is not watertight, because no edges is not the same as no
 *    holes.
 * 8. Negative twins: an empty face list, a two-corner face, a non-finite corner, a
 *    collinear face, and a non-planar face are each refused.
 */
export const test_geometry_procedural_topology = (): void => {
  const prism = extrudeAutoMovieProfile({
    profile: [
      { x: -1, y: -0.5 },
      { x: 1, y: -0.5 },
      { x: 1, y: 0.5 },
      { x: -1, y: 0.5 },
    ],
    depth: 0.25,
  });
  const b0 = { x: -1, y: 0, z: -2 };
  const b1 = { x: 1, y: 0, z: -2 };
  const b2 = { x: 1, y: 0, z: 2 };
  const b3 = { x: -1, y: 0, z: 2 };
  const r0 = { x: 0, y: 3, z: -2 };
  const r1 = { x: 0, y: 3, z: 2 };
  const ridged = buildAutoMoviePolyhedron([
    [b0, b1, b2, b3],
    [b1, r0, r1, b2],
    [b3, r1, r0, b0],
    [b0, r0, b1],
    [b2, r1, b3],
  ]);
  const ridgedTopology = inspectAutoMovieMeshTopology(ridged);
  TestValidator.equals(
    "a closed prism and a face-authored ridged solid report their exact volumes",
    namedFacts([
      [
        "prism",
        () => {
          const report = inspectAutoMovieMeshTopology(prism);
          return (
            report.watertight &&
            report.triangles === 12 &&
            report.degenerate === 0 &&
            report.boundaryEdges === 0 &&
            report.nonManifoldEdges === 0 &&
            nclose(report.volume, 2 * 1 * 0.25, 1e-12)
          );
        },
      ],
      ["ridgedClosed", () => ridgedTopology.watertight],
      ["ridgedTriangles", () => ridgedTopology.triangles === 8],
      [
        "ridgedVolume",
        () => nclose(ridgedTopology.volume, (2 * 3 * 4) / 2, 1e-12),
      ],
      [
        "ridgedUvs",
        () =>
          ridged.uvs !== null &&
          ridged.uvs.length === (ridged.positions.length / 3) * 2,
      ],
    ]),
    {
      prism: true,
      ridgedClosed: true,
      ridgedTriangles: true,
      ridgedVolume: true,
      ridgedUvs: true,
    },
  );

  const patch = meshOf([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2]);
  TestValidator.equals(
    "an open surface reports its boundary instead of claiming closure",
    summary(patch, ["triangles", "boundaryEdges", "watertight", "volume"]),
    { triangles: 1, boundaryEdges: 3, watertight: false, volume: 0 },
  );

  const fin = meshOf(
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1],
    [0, 1, 2, 0, 1, 3, 0, 1, 4],
  );
  const cutWall = buildAutoMovieWall({
    width: 4,
    height: 3,
    depth: 0.2,
    openings: [{ id: "window", x: 1, y: 1, width: 1, height: 1 }],
  });
  TestValidator.equals(
    "a shared edge and a cell assembly are reported non-manifold, not watertight",
    namedFacts([
      [
        "fin",
        () => {
          const report = inspectAutoMovieMeshTopology(fin);
          return (
            report.nonManifoldEdges === 1 &&
            report.boundaryEdges === 6 &&
            report.watertight === false
          );
        },
      ],
      [
        "assembly",
        () => {
          const report = inspectAutoMovieMeshTopology(cutWall);
          return report.nonManifoldEdges > 0 && report.watertight === false;
        },
      ],
      [
        "assemblyVolume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(cutWall).volume,
            (4 * 3 - 1) * 0.2,
            1e-12,
          ),
      ],
    ]),
    { fin: true, assembly: true, assemblyVolume: true },
  );

  TestValidator.equals(
    "a collapsed triangle is counted, not silently dropped",
    summary(meshOf([0, 0, 0, 1, 0, 0, 1, 0, 0], null), [
      "triangles",
      "degenerate",
      "watertight",
    ]),
    { triangles: 1, degenerate: 1, watertight: false },
  );

  TestValidator.equals(
    "non-finite components are counted across every present attribute",
    {
      all: inspectAutoMovieMeshTopology({
        positions: [Number.NaN, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, 0, Number.POSITIVE_INFINITY, 0, 0, 1, 0, 0, 1],
        uvs: [0, 0, 1, Number.NaN, 0, 1],
        indices: [0, 1, 2],
        skin: null,
      }).nonFinite,
      none: inspectAutoMovieMeshTopology(patch).nonFinite,
    },
    { all: 3, none: 0 },
  );

  TestValidator.equals(
    "corners a picosecond of a metre apart weld into one shared edge",
    inspectAutoMovieMeshTopology(
      meshOf(
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 1e-12, 0, 0, 1, 0, 0, 0, -1, 0],
        [0, 1, 2, 3, 4, 5],
      ),
    ).boundaryEdges,
    4,
  );

  TestValidator.equals(
    "an empty mesh is not watertight, because no edges is not no holes",
    summary(meshOf([], []), ["triangles", "watertight", "volume"]),
    { triangles: 0, watertight: false, volume: 0 },
  );

  TestValidator.predicate(
    "a placed solid keeps the topology it was built with",
    inspectAutoMovieMeshTopology(
      transformAutoMovieMesh(ridged, {
        rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
        scale: { x: -1, y: 1, z: 1 },
      }),
    ).watertight,
  );

  const refusals: Array<readonly [string, () => unknown, string]> = [
    [
      "no faces",
      () => buildAutoMoviePolyhedron([]),
      "polyhedron needs at least one face",
    ],
    [
      "two-corner face",
      () => buildAutoMoviePolyhedron([[b0, b1]]),
      "polyhedron face[0] needs at least three corners",
    ],
    [
      "non-finite corner",
      () => buildAutoMoviePolyhedron([[b0, b1, { x: Number.NaN, y: 0, z: 0 }]]),
      "polyhedron face[0] corner[2] must be finite",
    ],
    [
      "collinear face",
      () =>
        buildAutoMoviePolyhedron([
          [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 2, y: 0, z: 0 },
          ],
        ]),
      "polyhedron face[0] encloses no area",
    ],
    [
      "non-planar face",
      () => buildAutoMoviePolyhedron([[b0, b1, b2, { x: -1, y: 0.5, z: 2 }]]),
      "polyhedron face[0] is not planar",
    ],
  ];
  for (const [name, callback, message] of refusals)
    TestValidator.predicate(
      `${name} is refused by its own diagnostic`,
      throwsError(callback, message),
    );
};
