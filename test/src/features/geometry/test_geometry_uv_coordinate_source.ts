import {
  buildAutoMoviePolyhedron,
  buildAutoMovieWall,
  extrudeAutoMovieProfile,
  extrudeAutoMovieRegion,
  loftAutoMovieSections,
  revolveAutoMovieProfile,
  sweepAutoMovieProfile,
  tessellateToMesh,
} from "@automovie/engine";
import {
  AutoMovieTextureCoordinateSource,
  IAutoMovieMesh,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** The largest value either axis of a mesh's atlas reaches. */
const span = (mesh: IAutoMovieMesh, axis: 0 | 1): number => {
  let widest = Number.NEGATIVE_INFINITY;
  for (let at = axis; at < mesh.uvs!.length; at += 2)
    widest = Math.max(widest, mesh.uvs![at]!);
  return widest;
};

const square = (half: number): Array<{ x: number; y: number }> => [
  { x: -half, y: -half },
  { x: half, y: -half },
  { x: half, y: half },
  { x: -half, y: half },
];

/**
 * Which constructor emits texture coordinates, and the negative twin that says
 * the emitted ones are metres rather than a normalized box.
 *
 * A binding's `transform.scale` means one thing against coordinates measured in
 * metres and a different thing against coordinates spanning `[0, 1]`, and the
 * two differ by exactly the surface's own extent. A surface that quietly
 * changed source would therefore keep placing textures and keep placing them
 * wrong, so the census is pinned rather than left to the reader of one
 * operator's JSDoc.
 *
 * The three constructors that emit nothing each have an atlas-bearing
 * replacement, so their emptiness is a stated position with somewhere to go and
 * not an omission. Pinning it here is what stops the position from being
 * quietly abandoned in either direction.
 *
 * Scenarios:
 *
 * 1. The region extrusion, the loft, the revolution, and the polyhedron each
 *    emit one uv pair per vertex.
 * 2. The convex extrusion, the sweep, the wall, and the primitive tessellator
 *    each emit none, which is the declared position their JSDoc names a
 *    replacement for.
 * 3. Every emitting constructor reports the surface's own real dimension: a 3 m
 *    face spans 3, the reveal of a 3 by 1 m region spans that ring's 8 m
 *    perimeter, a 3 m loft path spans 3, and a 3 m-radius revolution spans its
 *    `6 * pi` m circumference.
 * 4. The negative twin: not one of those four spans a single unit, which is what
 *    a normalized box would read whatever the surface measured. The refusal is
 *    by measurement rather than by an assertion of intent.
 * 5. The region's developed ring exposes its cut explicitly from zero to the
 *    hand-computed 8 m perimeter rather than joining unequal phases by one
 *    backwards quad.
 * 6. The public source vocabulary keeps arbitrary imported UVs distinct from
 *    both metric and normalized sets; omission remains available to legacy
 *    bindings and therefore does not reinterpret their raw sampling.
 */
export const test_geometry_uv_coordinate_source = (): void => {
  const coordinateSources: readonly AutoMovieTextureCoordinateSource[] = [
    "surface-metres",
    "normalized",
    "source-uv",
  ];
  TestValidator.equals(
    "the coordinate-source vocabulary does not mislabel arbitrary imported UVs",
    coordinateSources,
    ["surface-metres", "normalized", "source-uv"],
  );

  const face = buildAutoMoviePolyhedron([
    [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0, z: 0 },
      { x: 3, y: 2, z: 0 },
      { x: 0, y: 2, z: 0 },
    ],
  ]);
  const region = extrudeAutoMovieRegion({
    outer: [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 0, y: 1 },
    ],
    depth: 0.2,
  });
  const lofted = loftAutoMovieSections({
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 3 },
    ],
    sections: [
      { at: 0, outer: square(0.5) },
      { at: 1, outer: square(0.5) },
    ],
  });
  const turned = revolveAutoMovieProfile({
    profile: [
      { x: 3, y: 0 },
      { x: 3, y: 1 },
    ],
    segments: 8,
  });

  TestValidator.equals(
    "every atlas-bearing constructor emits one uv pair per vertex",
    namedFacts([
      ["face", () => face.uvs!.length === (face.positions.length / 3) * 2],
      [
        "region",
        () => region.uvs!.length === (region.positions.length / 3) * 2,
      ],
      [
        "lofted",
        () => lofted.uvs!.length === (lofted.positions.length / 3) * 2,
      ],
      [
        "turned",
        () => turned.uvs!.length === (turned.positions.length / 3) * 2,
      ],
    ]),
    { face: true, region: true, lofted: true, turned: true },
  );

  TestValidator.equals(
    "the constructors that emit none say so, and each names a replacement",
    {
      convexExtrusion: extrudeAutoMovieProfile({
        profile: square(0.5),
        depth: 1,
      }).uvs,
      sweep: sweepAutoMovieProfile({
        profile: square(0.5),
        path: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 1 },
        ],
      }).uvs,
      wall: buildAutoMovieWall({
        width: 1,
        height: 1,
        depth: 0.1,
        openings: [],
      }).uvs,
      primitive: tessellateToMesh({
        type: "box",
        width: 1,
        height: 1,
        depth: 1,
      }).uvs,
    },
    { convexExtrusion: null, sweep: null, wall: null, primitive: null },
  );

  TestValidator.equals(
    "every emitting frame reports the surface's own real dimension in metres",
    namedFacts([
      ["face", () => nclose(span(face, 0), 3)],
      // The reveal runs the outer ring, whose perimeter is 3 + 1 + 3 + 1.
      ["region", () => nclose(span(region, 0), 8)],
      ["lofted", () => nclose(span(lofted, 1), 3)],
      ["turned", () => nclose(span(turned, 0), 2 * Math.PI * 3)],
    ]),
    { face: true, region: true, lofted: true, turned: true },
  );

  TestValidator.equals(
    "and none of them is a normalized box that would read one unit instead",
    namedFacts([
      ["face", () => nclose(span(face, 0), 1) === false],
      ["region", () => nclose(span(region, 0), 1) === false],
      ["lofted", () => nclose(span(lofted, 1), 1) === false],
      ["turned", () => nclose(span(turned, 0), 1) === false],
    ]),
    { face: true, region: true, lofted: true, turned: true },
  );

  // Four cap vertices per side precede four side quads. The first side begins
  // at vertex 8 and the last side ends at vertex 23.
  TestValidator.equals(
    "the region ring states its perimeter seam as a zero-to-eight-metre cut",
    namedFacts([
      ["opensAtZero", () => nclose(region.uvs![8 * 2]!, 0)],
      ["closesAtPerimeter", () => nclose(region.uvs![23 * 2]!, 8)],
      [
        "doesNotHideTheCut",
        () => nclose(region.uvs![8 * 2]!, region.uvs![23 * 2]!) === false,
      ],
    ]),
    { opensAtZero: true, closesAtPerimeter: true, doesNotHideTheCut: true },
  );
};
