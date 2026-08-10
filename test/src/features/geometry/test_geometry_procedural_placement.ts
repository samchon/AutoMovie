import {
  extrudeAutoMovieProfile,
  inspectAutoMovieMeshTopology,
  mergeAutoMovieMeshParts,
  transformAutoMovieMesh,
} from "@automovie/engine";
import { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

/** One right triangle on the XY plane, facing +Z, with a known UV corner. */
const facet = (): IAutoMovieMesh => ({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
  uvs: [0, 0, 1, 0, 0, 1],
  indices: [0, 1, 2],
  skin: null,
});

const close = (
  values: readonly number[],
  expected: readonly number[],
): boolean =>
  values.length === expected.length &&
  values.every((value, index) => nclose(value, expected[index]!, 1e-12));

/**
 * A rigid placement must carry a surface without lying about which way it
 * faces.
 *
 * Positions take the full translate/rotate/scale; normals take the inverse
 * transpose, because scaling a normal like a position tilts it off a
 * non-uniformly scaled surface; and a mirroring scale flips triangle winding so
 * the geometric face and the stored normal still agree. Every number below is
 * hand-computed from the authored placement, and the mirror case asserts the
 * two independent facts together: the stored normal and the normal implied by
 * the flipped winding are the same vector.
 *
 * Scenarios:
 *
 * 1. Scale (2, ½, 1), a 90° yaw, and a translation place the three corners at
 *    their hand-computed points and turn the +Z normal into +X.
 * 2. A mirroring scale flips winding, and the cross product of the reordered
 *    corners equals the inverse-transpose normal rather than its negation.
 * 3. UVs ride along untouched and a null-normal, non-indexed mesh stays null and
 *    gains the identity index run.
 * 4. Assembly members merge in declaration order, each owning an index range that
 *    addresses exactly its own triangles; a member with no transform is merged
 *    in place.
 * 5. A placed unit prism keeps its volume under rotation and multiplies it by the
 *    scale determinant.
 * 6. Negative twins: skinning, a non-unit quaternion, a collapsed axis, a
 *    non-finite translation or scale, a blank id, and a duplicate id are all
 *    refused by their own diagnostic.
 */
export const test_geometry_procedural_placement = (): void => {
  const yawed = transformAutoMovieMesh(facet(), {
    translation: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
    scale: { x: 2, y: 0.5, z: 1 },
  });
  TestValidator.equals(
    "a placement carries positions fully and normals by the inverse transpose",
    namedFacts([
      [
        "positions",
        () => close(yawed.positions, [1, 2, 3, 1, 2, 1, 1, 2.5, 3]),
      ],
      ["normals", () => close(yawed.normals!, [1, 0, 0, 1, 0, 0, 1, 0, 0])],
      ["uvs", () => close(yawed.uvs!, [0, 0, 1, 0, 0, 1])],
      ["winding", () => JSON.stringify(yawed.indices) === "[0,1,2]"],
    ]),
    { positions: true, normals: true, uvs: true, winding: true },
  );

  const mirrored = transformAutoMovieMesh(facet(), {
    scale: { x: -1, y: 1, z: 1 },
  });
  const geometric = (mesh: IAutoMovieMesh): readonly number[] => {
    const [a, b, c] = mesh.indices!.slice(0, 3).map((index) => index * 3);
    const p = mesh.positions;
    const ab = [
      p[b!]! - p[a!]!,
      p[b! + 1]! - p[a! + 1]!,
      p[b! + 2]! - p[a! + 2]!,
    ];
    const ac = [
      p[c!]! - p[a!]!,
      p[c! + 1]! - p[a! + 1]!,
      p[c! + 2]! - p[a! + 2]!,
    ];
    return [
      ab[1]! * ac[2]! - ab[2]! * ac[1]!,
      ab[2]! * ac[0]! - ab[0]! * ac[2]!,
      ab[0]! * ac[1]! - ab[1]! * ac[0]!,
    ];
  };
  TestValidator.equals(
    "a mirroring scale flips winding so the drawn face still matches its normal",
    namedFacts([
      [
        "positions",
        () => close(mirrored.positions, [0, 0, 0, -1, 0, 0, 0, 1, 0]),
      ],
      ["flipped", () => JSON.stringify(mirrored.indices) === "[0,2,1]"],
      ["normals", () => close(mirrored.normals!, [0, 0, 1, 0, 0, 1, 0, 0, 1])],
      ["agrees", () => geometric(mirrored)[2]! > 0],
      ["unmirroredAgrees", () => geometric(yawed)[0]! > 0],
    ]),
    {
      positions: true,
      flipped: true,
      normals: true,
      agrees: true,
      unmirroredAgrees: true,
    },
  );

  const bare = transformAutoMovieMesh(
    {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      normals: null,
      uvs: null,
      indices: null,
      skin: null,
    },
    { scale: { x: 1, y: 1, z: -1 } },
  );
  TestValidator.equals(
    "a null-attribute non-indexed mesh keeps its nulls and gains an index run",
    {
      normals: bare.normals,
      uvs: bare.uvs,
      indices: JSON.stringify(bare.indices),
    },
    { normals: null, uvs: null, indices: "[0,2,1]" },
  );

  const prism = extrudeAutoMovieProfile({
    profile: [
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: 0.5, y: 0.5 },
      { x: -0.5, y: 0.5 },
    ],
    depth: 1,
  });
  TestValidator.equals(
    "a placed prism keeps its volume under rotation and scales it by the determinant",
    namedFacts([
      [
        "unit",
        () => nclose(inspectAutoMovieMeshTopology(prism).volume, 1, 1e-12),
      ],
      [
        "rotated",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(
              transformAutoMovieMesh(prism, {
                rotation: { x: 0.5, y: 0.5, z: 0.5, w: 0.5 },
                translation: { x: 7, y: -3, z: 2 },
              }),
            ).volume,
            1,
            1e-12,
          ),
      ],
      [
        "scaled",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(
              transformAutoMovieMesh(prism, { scale: { x: 2, y: 3, z: 4 } }),
            ).volume,
            24,
            1e-12,
          ),
      ],
      [
        "mirroredVolume",
        () =>
          nclose(
            inspectAutoMovieMeshTopology(
              transformAutoMovieMesh(prism, { scale: { x: -2, y: 3, z: 4 } }),
            ).volume,
            24,
            1e-12,
          ),
      ],
    ]),
    { unit: true, rotated: true, scaled: true, mirroredVolume: true },
  );

  const assembly = mergeAutoMovieMeshParts([
    { id: "here", mesh: facet() },
    {
      id: "there",
      mesh: facet(),
      transform: { translation: { x: 10, y: 0, z: 0 } },
    },
    {
      id: "loose",
      mesh: {
        positions: [0, 0, 0, 0, 0, 1, 0, 1, 0],
        normals: null,
        uvs: null,
        indices: null,
        skin: null,
      },
    },
  ]);
  TestValidator.equals(
    "assembly members merge in order and each owns exactly its own index range",
    {
      groups: assembly.groups,
      indices: assembly.mesh.indices!.length,
      normals: assembly.mesh.normals,
      uvs: assembly.mesh.uvs,
      placed: assembly.mesh.positions[12]!,
    },
    {
      groups: [
        { id: "here", start: 0, count: 3 },
        { id: "there", start: 3, count: 3 },
        { id: "loose", start: 6, count: 3 },
      ],
      indices: 9,
      normals: null,
      uvs: null,
      placed: 11,
    },
  );
  TestValidator.equals(
    "an empty assembly is an empty mesh with no groups",
    {
      groups: mergeAutoMovieMeshParts([]).groups,
      positions: mergeAutoMovieMeshParts([]).mesh.positions.length,
    },
    { groups: [], positions: 0 },
  );

  const skinned: IAutoMovieMesh = {
    ...facet(),
    skin: { joints: [], boneIndices: [], weights: [] },
  };
  const refusals: Array<readonly [string, () => unknown, string]> = [
    [
      "skinned placement",
      () => transformAutoMovieMesh(skinned, {}),
      "procedural mesh transform does not accept skinning",
    ],
    [
      "non-unit rotation",
      () =>
        transformAutoMovieMesh(facet(), {
          rotation: { x: 0, y: 0, z: 0, w: 0.5 },
        }),
      "mesh transform rotation must be a unit quaternion",
    ],
    [
      "non-finite rotation",
      () =>
        transformAutoMovieMesh(facet(), {
          rotation: { x: Number.NaN, y: 0, z: 0, w: 1 },
        }),
      "mesh transform rotation must be a unit quaternion",
    ],
    [
      "collapsed axis",
      () => transformAutoMovieMesh(facet(), { scale: { x: 1, y: 0, z: 1 } }),
      "mesh transform scale may not collapse an axis",
    ],
    [
      "non-finite translation",
      () =>
        transformAutoMovieMesh(facet(), {
          translation: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
        }),
      "mesh transform translation must be finite",
    ],
    [
      "non-finite scale",
      () =>
        transformAutoMovieMesh(facet(), {
          scale: { x: 1, y: Number.NaN, z: 1 },
        }),
      "mesh transform scale must be finite",
    ],
    [
      "blank part id",
      () => mergeAutoMovieMeshParts([{ id: "  ", mesh: facet() }]),
      "mesh part id must be non-empty",
    ],
    [
      "duplicate part id",
      () =>
        mergeAutoMovieMeshParts([
          { id: "twin", mesh: facet() },
          { id: "twin", mesh: facet() },
        ]),
      'mesh part id "twin" must be unique',
    ],
  ];
  for (const [name, callback, message] of refusals)
    TestValidator.predicate(
      `${name} is refused by its own diagnostic`,
      throwsError(callback, message),
    );
};
