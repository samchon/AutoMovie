import {
  buildAutoMovieWall,
  extrudeAutoMovieProfile,
  inspectAutoMovieMeshTopology,
  mergeAutoMovieMeshes,
  revolveAutoMovieProfile,
  sweepAutoMovieProfile,
  tessellate,
} from "@automovie/engine";
import { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

const square = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
];

const finiteMesh = (mesh: IAutoMovieMesh): boolean =>
  mesh.positions.every(Number.isFinite) &&
  (mesh.normals?.every(Number.isFinite) ?? true) &&
  (mesh.indices?.every(Number.isSafeInteger) ?? true);

/**
 * The convex procedural kernel: extrusion, revolution, sweep, opening-aware
 * wall segmentation, and rigid merge.
 *
 * Every expectation here is hand math against the authored dimensions, never a
 * snapshot of emitted arrays: a 2 m square extruded 0.5 m is an 8-vertex prism
 * of exactly 2 m³, and a wall cut by two openings is exactly the cells the cut
 * lattice leaves standing. The kernel's declared boundary is the convex profile
 * gate; a concave contour or an interior point is refused loudly here, and
 * generalizing it is a separate obligation, so this case pins the refusal
 * rather than pretending the capability exists.
 *
 * Scenarios:
 *
 * 1. A convex square extrudes to a closed 8-vertex prism whose divergence volume
 *    is exactly `width · height · depth` and whose every welded edge is shared
 *    by two triangles.
 * 2. A radius profile revolves into `(segments + 1) · points` vertices, and a
 *    zero-radius endpoint keeps its pole triangles reported as degenerate
 *    rather than silently dropped.
 * 3. A bent sweep and a vertical sweep both close, exercising both arms of the
 *    frame-guide choice that keeps the local frame stable.
 * 4. A wall cut by a door and a window emits exactly the surviving lattice cells,
 *    and its volume equals the wall solid minus both openings.
 * 5. Merge rebases indexed and non-indexed inputs and keeps only attributes every
 *    input carries.
 * 6. Determinism: two builds from the same input are byte-identical.
 * 7. Regression: primitive tessellation is untouched by the procedural kernel.
 * 8. Negative twins: every guard refuses, one property away from a positive.
 */
export const test_geometry_procedural_architecture = (): void => {
  const extrusion = extrudeAutoMovieProfile({ profile: square, depth: 0.5 });
  const extrusionTopology = inspectAutoMovieMeshTopology(extrusion);
  TestValidator.equals(
    "a convex profile extrudes to one closed prism of the authored volume",
    namedFacts([
      ["finite", () => finiteMesh(extrusion)],
      ["vertices", () => extrusion.positions.length === 8 * 3],
      ["triangles", () => extrusion.indices!.length === 12 * 3],
      [
        "depth",
        () =>
          Math.min(
            ...extrusion.positions.filter((_, index) => index % 3 === 2),
          ) === -0.25 &&
          Math.max(
            ...extrusion.positions.filter((_, index) => index % 3 === 2),
          ) === 0.25,
      ],
      ["watertight", () => extrusionTopology.watertight],
      ["volume", () => nclose(extrusionTopology.volume, 2 * 2 * 0.5, 1e-12)],
    ]),
    {
      finite: true,
      vertices: true,
      triangles: true,
      depth: true,
      watertight: true,
      volume: true,
    },
  );

  const revolved = revolveAutoMovieProfile({
    profile: [
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    segments: 8,
  });
  TestValidator.equals(
    "a radius profile revolves with a closed seam and reported pole degeneracy",
    namedFacts([
      ["finite", () => finiteMesh(revolved)],
      ["rings", () => revolved.positions.length === 9 * 4 * 3],
      ["triangles", () => revolved.indices!.length === 8 * 3 * 2 * 3],
      [
        "poles",
        () => inspectAutoMovieMeshTopology(revolved).degenerate === 8 * 2,
      ],
    ]),
    { finite: true, rings: true, triangles: true, poles: true },
  );

  const swept = sweepAutoMovieProfile({
    profile: square.map((point) => ({ x: point.x * 0.1, y: point.y * 0.1 })),
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 2, z: 0 },
    ],
  });
  const vertical = sweepAutoMovieProfile({
    profile: square,
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 },
    ],
  });
  TestValidator.equals(
    "sweeps cover horizontal bends and the vertical frame fallback",
    namedFacts([
      ["bent", () => finiteMesh(swept) && swept.indices!.length > 0],
      ["vertical", () => finiteMesh(vertical) && vertical.indices!.length > 0],
      [
        "verticalVolume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(vertical).volume,
            2 * 2 * 2,
            1e-12,
          ),
      ],
    ]),
    { bent: true, vertical: true, verticalVolume: true },
  );

  const wall = buildAutoMovieWall({
    width: 8,
    height: 4,
    depth: 0.3,
    openings: [
      { id: "door", x: 1, y: 0, width: 1.5, height: 2.4 },
      { id: "window", x: 4, y: 1.2, width: 2, height: 1.4 },
    ],
  });
  const plainWall = buildAutoMovieWall({
    width: 2,
    height: 2,
    depth: 0.2,
    openings: [],
  });
  TestValidator.equals(
    "opening-aware segmentation leaves exactly the standing wall solid",
    namedFacts([
      ["finite", () => finiteMesh(wall)],
      ["cut", () => wall.positions.length > plainWall.positions.length],
      ["indexed", () => wall.indices !== null && wall.indices.length > 0],
      [
        "volume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(wall).volume,
            (8 * 4 - 1.5 * 2.4 - 2 * 1.4) * 0.3,
            1e-12,
          ),
      ],
      [
        "plainVolume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(plainWall).volume,
            2 * 2 * 0.2,
            1e-12,
          ),
      ],
    ]),
    {
      finite: true,
      cut: true,
      indexed: true,
      volume: true,
      plainVolume: true,
    },
  );

  const nonIndexed: IAutoMovieMesh = {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    normals: null,
    uvs: [0, 0, 1, 0, 0, 1],
    indices: null,
    skin: null,
  };
  const merged = mergeAutoMovieMeshes([plainWall, nonIndexed]);
  const mergedUvs = mergeAutoMovieMeshes([
    { ...nonIndexed, normals: [0, 0, 1, 0, 0, 1, 0, 0, 1] },
    { ...nonIndexed, normals: [0, 0, 1, 0, 0, 1, 0, 0, 1] },
  ]);
  TestValidator.equals(
    "mesh merge rebases indexed/non-indexed inputs and keeps only common attributes",
    namedFacts([
      [
        "rebased",
        () => merged.indices!.at(-1) === plainWall.positions.length / 3 + 2,
      ],
      ["dropsNormals", () => merged.normals === null],
      ["dropsUvs", () => merged.uvs === null],
      ["keepsUvs", () => mergedUvs.uvs?.length === 12],
      ["keepsNormals", () => mergedUvs.normals?.length === 18],
      ["empty", () => mergeAutoMovieMeshes([]).positions.length === 0],
    ]),
    {
      rebased: true,
      dropsNormals: true,
      dropsUvs: true,
      keepsUvs: true,
      keepsNormals: true,
      empty: true,
    },
  );

  TestValidator.equals(
    "the same authored input rebuilds byte-identically",
    [
      JSON.stringify(extrudeAutoMovieProfile({ profile: square, depth: 0.5 })),
      JSON.stringify(
        buildAutoMovieWall({
          width: 8,
          height: 4,
          depth: 0.3,
          openings: [
            { id: "door", x: 1, y: 0, width: 1.5, height: 2.4 },
            { id: "window", x: 4, y: 1.2, width: 2, height: 1.4 },
          ],
        }),
      ),
    ],
    [JSON.stringify(extrusion), JSON.stringify(wall)],
  );

  const box = tessellate({ type: "box", width: 2, height: 2, depth: 0.2 });
  TestValidator.equals(
    "existing primitive tessellation is untouched by the procedural kernel",
    { vertices: box.positions.length, indices: box.indices.length },
    { vertices: 24 * 3, indices: 12 * 3 },
  );

  const invalids: Array<readonly [string, () => unknown, string]> = [
    [
      "extrusion depth",
      () => extrudeAutoMovieProfile({ profile: square, depth: 0 }),
      "extrusion depth must be a finite number > 0",
    ],
    [
      "profile finite",
      () =>
        extrudeAutoMovieProfile({
          profile: [{ x: Number.NaN, y: 0 }, ...square],
          depth: 1,
        }),
      "profile[0] must be finite",
    ],
    [
      "profile area",
      () =>
        extrudeAutoMovieProfile({
          profile: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
          ],
          depth: 1,
        }),
      "profile needs at least three non-collinear points",
    ],
    [
      "profile convexity",
      () =>
        extrudeAutoMovieProfile({
          profile: [...square, { x: 0, y: 0 }],
          depth: 1,
        }),
      "profile must be convex and contain no interior points",
    ],
    [
      "concave profile",
      () =>
        extrudeAutoMovieProfile({
          profile: [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 1 },
            { x: 1, y: 1 },
            { x: 1, y: 3 },
            { x: 0, y: 3 },
          ],
          depth: 1,
        }),
      "profile must be convex and contain no interior points",
    ],
    [
      "revolve points",
      () => revolveAutoMovieProfile({ profile: [{ x: 1, y: 0 }], segments: 8 }),
      "revolve profile needs at least two points",
    ],
    [
      "revolve segments",
      () => revolveAutoMovieProfile({ profile: square, segments: 2 }),
      "revolve segments must be a safe integer >= 3",
    ],
    [
      "revolve fractional segments",
      () => revolveAutoMovieProfile({ profile: square, segments: 3.5 }),
      "revolve segments must be a safe integer >= 3",
    ],
    [
      "revolve finite",
      () =>
        revolveAutoMovieProfile({
          profile: [
            { x: 1, y: Number.NaN },
            { x: 1, y: 1 },
          ],
          segments: 8,
        }),
      "revolve profile[0] must be finite",
    ],
    [
      "revolve radius",
      () =>
        revolveAutoMovieProfile({
          profile: [
            { x: -1, y: 0 },
            { x: 1, y: 1 },
          ],
          segments: 8,
        }),
      "revolve profile[0] radius must be >= 0",
    ],
    [
      "sweep path",
      () =>
        sweepAutoMovieProfile({
          profile: square,
          path: [{ x: 0, y: 0, z: 0 }],
        }),
      "sweep path needs at least two points",
    ],
    [
      "sweep finite",
      () =>
        sweepAutoMovieProfile({
          profile: square,
          path: [
            { x: 0, y: 0, z: 0 },
            { x: Number.NaN, y: 1, z: 0 },
          ],
        }),
      "sweep path[1] must be finite",
    ],
    [
      "sweep frame",
      () =>
        sweepAutoMovieProfile({
          profile: square,
          path: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
          ],
        }),
      "sweep path around point 0 is degenerate",
    ],
    [
      "wall width",
      () => buildAutoMovieWall({ width: 0, height: 1, depth: 1, openings: [] }),
      "wall width must be a finite number > 0",
    ],
    [
      "wall height",
      () =>
        buildAutoMovieWall({
          width: 1,
          height: Number.NaN,
          depth: 1,
          openings: [],
        }),
      "wall height must be a finite number > 0",
    ],
    [
      "wall depth",
      () =>
        buildAutoMovieWall({ width: 1, height: 1, depth: -1, openings: [] }),
      "wall depth must be a finite number > 0",
    ],
    [
      "opening id",
      () =>
        buildAutoMovieWall({
          width: 2,
          height: 2,
          depth: 1,
          openings: [{ id: " ", x: 0, y: 0, width: 1, height: 1 }],
        }),
      "wall opening[0] id must be non-empty",
    ],
    [
      "opening duplicate",
      () =>
        buildAutoMovieWall({
          width: 3,
          height: 2,
          depth: 1,
          openings: [
            { id: "x", x: 0, y: 0, width: 1, height: 1 },
            { id: "x", x: 2, y: 0, width: 1, height: 1 },
          ],
        }),
      'wall opening id "x" must be unique',
    ],
    [
      "opening finite",
      () =>
        buildAutoMovieWall({
          width: 2,
          height: 2,
          depth: 1,
          openings: [{ id: "x", x: Number.NaN, y: 0, width: 1, height: 1 }],
        }),
      "wall opening[0] must be finite",
    ],
    [
      "opening width",
      () =>
        buildAutoMovieWall({
          width: 2,
          height: 2,
          depth: 1,
          openings: [{ id: "x", x: 0, y: 0, width: 0, height: 1 }],
        }),
      "wall opening[0] width must be a finite number > 0",
    ],
    [
      "opening height",
      () =>
        buildAutoMovieWall({
          width: 2,
          height: 2,
          depth: 1,
          openings: [{ id: "x", x: 0, y: 0, width: 1, height: -1 }],
        }),
      "wall opening[0] height must be a finite number > 0",
    ],
    [
      "opening bounds",
      () =>
        buildAutoMovieWall({
          width: 2,
          height: 2,
          depth: 1,
          openings: [{ id: "x", x: 1.5, y: 0, width: 1, height: 1 }],
        }),
      'wall opening "x" must stay inside the wall',
    ],
    [
      "opening overlap",
      () =>
        buildAutoMovieWall({
          width: 3,
          height: 2,
          depth: 1,
          openings: [
            { id: "a", x: 0, y: 0, width: 2, height: 1 },
            { id: "b", x: 1, y: 0, width: 2, height: 1 },
          ],
        }),
      'wall openings "a" and "b" overlap',
    ],
    [
      "opening removes wall",
      () =>
        buildAutoMovieWall({
          width: 2,
          height: 2,
          depth: 1,
          openings: [{ id: "all", x: 0, y: 0, width: 2, height: 2 }],
        }),
      "wall openings remove the entire wall",
    ],
    [
      "skinned merge",
      () =>
        mergeAutoMovieMeshes([
          { ...nonIndexed, skin: { joints: [], boneIndices: [], weights: [] } },
        ]),
      "procedural rigid-mesh merge does not accept skinning",
    ],
  ];
  for (const [name, callback, message] of invalids)
    TestValidator.predicate(
      `${name} is refused by its own diagnostic`,
      throwsError(callback, message),
    );

  TestValidator.equals(
    "a bow-tie ordering of convex-position points is normalized to its hull, not refused",
    JSON.stringify(
      extrudeAutoMovieProfile({
        profile: [
          { x: -1, y: -1 },
          { x: 1, y: 1 },
          { x: 1, y: -1 },
          { x: -1, y: 1 },
        ],
        depth: 0.5,
      }),
    ),
    JSON.stringify(extrusion),
  );
};
