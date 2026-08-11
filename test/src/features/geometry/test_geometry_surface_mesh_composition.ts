import {
  buildAutoMovieWall,
  inspectAutoMovieMeshTopology,
  mergeAutoMovieMeshes,
  tessellateSurface,
  transformAutoMovieMesh,
} from "@automovie/engine";
import { IAutoMovieMesh, IAutoMovieSurface } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** A square plate over a 2x2 lattice with one raised corner. */
const slope: IAutoMovieSurface = {
  id: "slope",
  kind: "floor",
  polygon: [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 2, y: 0, z: 2 },
    { x: 0, y: 0, z: 2 },
  ],
  height: {
    kind: "heightfield",
    originX: 0,
    originZ: 0,
    spacingX: 2,
    spacingZ: 2,
    columns: 2,
    rows: 2,
    samples: [0, 0, 0, 1],
  },
};

/**
 * The ground a production tessellates is a mesh the rest of the vocabulary
 * takes.
 *
 * `GEOMETRY` teaches one set of mesh operations -- build, transform, merge,
 * measure -- and in the same breath tells an author to tessellate a declared
 * support surface so the drawn ground and the queried ground are one bilinear
 * evaluation. Those two halves only meet if the tessellation is that same mesh
 * record. It was not: it returned a private buffer triple, so the first thing
 * an author reached for after building terrain -- measuring it -- did not
 * type-check, and a production paid for a hand-written conversion that said
 * nothing the engine did not already know.
 *
 * Being a mesh is therefore the contract, and the fields that make it one are
 * asserted rather than assumed. `normals` and `indices` stay non-null in the
 * narrowed type because a tessellation always computes both, so a reader keeps
 * the certainty it already had while the value gains a vocabulary.
 *
 * Scenarios:
 *
 * 1. `inspectAutoMovieMeshTopology` accepts the tessellation directly and counts
 *    exactly the triangles its own index buffer carries.
 * 2. `transformAutoMovieMesh` accepts it and lifts every vertex by the stated
 *    translation, so ground can be placed rather than only drawn where declared.
 * 3. `mergeAutoMovieMeshes` accepts it beside a constructor-built mesh, which is
 *    a production carrying its terrain as one part of a model it owns.
 * 4. It declares itself rigid and unmapped: no skin, no texture coordinates.
 *    A tessellation that claimed a skin would be refused by every one of the
 *    composition operations above, which reject skinned meshes.
 * 5. Negative twin: a footprint enclosing no area is still `null` rather than an
 *    empty mesh, so "nothing to draw" stays distinguishable from "a mesh with no
 *    triangles".
 */
export const test_geometry_surface_mesh_composition = (): void => {
  const ground = tessellateSurface(slope);
  if (ground === null) throw new Error("the slope encloses area");

  // Assigning through the interface type is itself the claim under test: it
  // compiles only while a tessellation is a mesh.
  const asMesh: IAutoMovieMesh = ground;
  const topology = inspectAutoMovieMeshTopology(asMesh);
  const lifted = transformAutoMovieMesh(ground, {
    translation: { x: 0, y: 5, z: 0 },
  });
  const wall = buildAutoMovieWall({
    width: 2,
    height: 1,
    depth: 0.2,
    openings: [],
  });
  const merged = mergeAutoMovieMeshes([ground, wall]);

  const flat: IAutoMovieSurface = {
    ...slope,
    id: "flat",
    polygon: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ],
  };

  TestValidator.equals(
    "a tessellated surface enters the mesh vocabulary the same guide teaches",
    namedFacts([
      [
        "topologyCountsItsOwnTriangles",
        () => topology.triangles === ground.indices.length / 3,
      ],
      [
        "andFindsRealGeometryRatherThanNothing",
        () => topology.triangles !== 0 && topology.nonFinite === 0,
      ],
      [
        "itCanBePlacedLikeAnyOtherMesh",
        () =>
          lifted.positions.every((value, index) =>
            index % 3 === 1
              ? nclose(value, ground.positions[index]! + 5)
              : nclose(value, ground.positions[index]!),
          ),
      ],
      [
        "andMergedWithWhatStandsOnIt",
        () =>
          merged.positions.length ===
          ground.positions.length + wall.positions.length,
      ],
      ["itIsRigid", () => ground.skin === null],
      ["andCarriesNoTextureCoordinates", () => ground.uvs === null],
      [
        "andStillReportsNothingRatherThanAnEmptyMesh",
        () => tessellateSurface(flat) === null,
      ],
    ]),
    {
      topologyCountsItsOwnTriangles: true,
      andFindsRealGeometryRatherThanNothing: true,
      itCanBePlacedLikeAnyOtherMesh: true,
      andMergedWithWhatStandsOnIt: true,
      itIsRigid: true,
      andCarriesNoTextureCoordinates: true,
      andStillReportsNothingRatherThanAnEmptyMesh: true,
    },
  );
};
