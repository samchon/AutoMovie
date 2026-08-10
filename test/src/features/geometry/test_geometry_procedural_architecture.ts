import {
  buildAutoMovieWall,
  extrudeAutoMovieProfile,
  mergeAutoMovieMeshes,
  revolveAutoMovieProfile,
  sweepAutoMovieProfile,
  tessellateSurface,
} from "@automovie/engine";
import { IAutoMovieMesh, IAutoMovieSurface } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const square = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
];

const throws = (callback: () => unknown): boolean => {
  try {
    callback();
    return false;
  } catch {
    return true;
  }
};

const finiteMesh = (mesh: IAutoMovieMesh): boolean =>
  mesh.positions.every(Number.isFinite) &&
  (mesh.normals?.every(Number.isFinite) ?? true) &&
  (mesh.indices?.every(Number.isSafeInteger) ?? true);

/** Procedural construction helpers turn small code-owned profiles into meshes. */
export const test_geometry_procedural_architecture = (): void => {
  const extrusion = extrudeAutoMovieProfile({ profile: square, depth: 0.5 });
  TestValidator.equals(
    "a convex profile extrudes to one finite closed mesh",
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
    ]),
    { finite: true, vertices: true, triangles: true, depth: true },
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
    "a radius profile revolves with a closed seam",
    namedFacts([
      ["finite", () => finiteMesh(revolved)],
      ["rings", () => revolved.positions.length === 9 * 4 * 3],
      ["triangles", () => revolved.indices!.length === 8 * 3 * 2 * 3],
    ]),
    { finite: true, rings: true, triangles: true },
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
    "sweeps cover horizontal bends and vertical frame fallback",
    namedFacts([
      ["bent", () => finiteMesh(swept) && swept.indices!.length > 0],
      ["vertical", () => finiteMesh(vertical) && vertical.indices!.length > 0],
    ]),
    { bent: true, vertical: true },
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
    "wall openings produce deterministic rigid mesh cells",
    namedFacts([
      ["finite", () => finiteMesh(wall)],
      ["cut", () => wall.positions.length > plainWall.positions.length],
      ["indexed", () => wall.indices !== null && wall.indices.length > 0],
    ]),
    { finite: true, cut: true, indexed: true },
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
    "mesh merge rebases indexed/non-indexed inputs and preserves only common attributes",
    namedFacts([
      [
        "rebased",
        () => merged.indices!.at(-1) === plainWall.positions.length / 3 + 2,
      ],
      ["dropsNormals", () => merged.normals === null],
      ["dropsUvs", () => merged.uvs === null],
      ["keepsUvs", () => mergedUvs.uvs?.length === 12],
      ["empty", () => mergeAutoMovieMeshes([]).positions.length === 0],
    ]),
    {
      rebased: true,
      dropsNormals: true,
      dropsUvs: true,
      keepsUvs: true,
      empty: true,
    },
  );

  const heightfield: IAutoMovieSurface = {
    id: "relief",
    kind: "floor",
    polygon: [
      { x: 0, y: 0, z: 1 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 1 },
      { x: 1, y: 0, z: 2 },
    ],
    height: {
      kind: "heightfield",
      originX: 0,
      originZ: 0,
      spacingX: 1,
      spacingZ: 1,
      columns: 3,
      rows: 3,
      samples: [0, 0, 0, 0, 2, 0, 0, 0, 0],
    },
  };
  const relief = tessellateSurface(heightfield)!;
  const center = relief.positions.findIndex(
    (value, index) =>
      index % 3 === 0 && value === 1 && relief.positions[index + 2] === 1,
  );
  TestValidator.equals(
    "heightfield tessellation clips the footprint and keeps its interior relief",
    namedFacts([
      ["triangles", () => relief.indices.length > 2 * 3],
      ["center", () => center >= 0 && nclose(relief.positions[center + 1]!, 2)],
      [
        "normals",
        () =>
          relief.normals.some(
            (value, index) => index % 3 !== 1 && Math.abs(value) > 0,
          ),
      ],
    ]),
    { triangles: true, center: true, normals: true },
  );
  TestValidator.equals(
    "a planar surface remains one fan and a degenerate surface remains absent",
    {
      plane: tessellateSurface({
        ...heightfield,
        height: { kind: "constant", value: 3 },
      })!.indices.length,
      line: tessellateSurface({
        ...heightfield,
        polygon: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 2, y: 0, z: 0 },
        ],
      }),
    },
    { plane: 6, line: null },
  );

  const invalids: Array<readonly [string, () => unknown]> = [
    [
      "extrusion depth",
      () => extrudeAutoMovieProfile({ profile: square, depth: 0 }),
    ],
    [
      "profile finite",
      () =>
        extrudeAutoMovieProfile({
          profile: [{ x: Number.NaN, y: 0 }, ...square],
          depth: 1,
        }),
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
    ],
    [
      "profile convexity",
      () =>
        extrudeAutoMovieProfile({
          profile: [...square, { x: 0, y: 0 }],
          depth: 1,
        }),
    ],
    [
      "revolve points",
      () => revolveAutoMovieProfile({ profile: [{ x: 1, y: 0 }], segments: 8 }),
    ],
    [
      "revolve segments",
      () => revolveAutoMovieProfile({ profile: square, segments: 2 }),
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
    ],
    [
      "sweep path",
      () =>
        sweepAutoMovieProfile({
          profile: square,
          path: [{ x: 0, y: 0, z: 0 }],
        }),
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
    ],
    [
      "sweep tangent",
      () =>
        sweepAutoMovieProfile({
          profile: square,
          path: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
          ],
        }),
    ],
    [
      "wall width",
      () => buildAutoMovieWall({ width: 0, height: 1, depth: 1, openings: [] }),
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
    ],
    [
      "wall depth",
      () =>
        buildAutoMovieWall({ width: 1, height: 1, depth: -1, openings: [] }),
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
    ],
    [
      "skinned merge",
      () =>
        mergeAutoMovieMeshes([
          { ...nonIndexed, skin: { joints: [], boneIndices: [], weights: [] } },
        ]),
    ],
  ];
  for (const [name, callback] of invalids)
    TestValidator.equals(`${name} is refused`, throws(callback), true);
};
