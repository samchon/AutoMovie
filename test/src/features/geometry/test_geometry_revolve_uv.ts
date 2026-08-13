import {
  buildAutoMovieWall,
  extrudeAutoMovieRegion,
  inspectAutoMovieMeshTopology,
  mergeAutoMovieMeshes,
  revolveAutoMovieProfile,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** The uv pair the vertex at `at` carries. */
const uvAt = (
  uvs: readonly number[],
  at: number,
): { u: number; v: number } => ({ u: uvs[at * 2]!, v: uvs[at * 2 + 1]! });

const CYLINDER_RADIUS = 1;
const CYLINDER_HEIGHT = 2;
const CYLINDER_SEGMENTS = 4;

/** A straight meridian at a constant radius: an open tube, rim at each end. */
const cylinderProfile = [
  { x: CYLINDER_RADIUS, y: 0 },
  { x: CYLINDER_RADIUS, y: CYLINDER_HEIGHT },
];

/**
 * The metric atlas a surface of revolution carries, which it had none of before.
 *
 * A revolved form is where balusters, candlesticks, basins and finials come
 * from, and a surface with no texture coordinates cannot carry a finish at all,
 * however correct its geometry measures. The coordinates emitted here are the
 * same pair the swept and lofted surfaces measure, so one declared scale reads
 * the same on a turned baluster and on the rail it holds up: distance travelled
 * around the section against distance travelled along the path.
 *
 * Every expected number is the surface's own geometry rather than the builder's
 * output. A cylinder of radius 1 m has a circumference of exactly `2 * pi` m, so
 * the closing ring must read that and not one turn of something normalized; its
 * meridian is 2 m of straight polyline, so the far ring must read 2. A cone's
 * meridian rising 1 m over 1 m of radius is `sqrt(2)` m of slant, not the 1 m
 * of either leg.
 *
 * Scenarios:
 *
 * 1. A revolved surface carries one uv pair per vertex, where it carried none.
 * 2. The seam is an explicit cut over the true circumference: around runs
 *    against the build direction as `2 * pi - theta` so the atlas stays
 *    right-handed, which puts `2 * pi * r` on the first ring and zero on the
 *    duplicate closing ring, and the last quad still does not interpolate
 *    backwards. The phases are deliberately unequal when the repeat does not
 *    divide that circumference.
 * 3. Along is the meridian's own length, so a 2 m tube spans 0 to 2, and one
 *    quarter of the way round the lattice reads `3 * pi / 2` m of arc because
 *    around counts down; both are metres and neither is in `[0, 1]`.
 * 4. A cone's slant is measured as slant: `sqrt(2)` for a meridian rising 1 m
 *    over 1 m, and its pole ring reads zero around at every segment, because a
 *    circle of no radius has no arc to travel. The six collapsed pole triangles
 *    remain the operator's declared degenerates while every UV stays finite;
 *    the open-tube twin has none.
 * 5. A merge with another coordinate-bearing member keeps the coordinates, and a
 *    merge with a coordinate-less one drops them for the whole assembly, which
 *    is the stated all-or-nothing rule.
 * 6. The same authored meridian rebuilds byte-identically.
 */
export const test_geometry_revolve_uv = (): void => {
  const tube = revolveAutoMovieProfile({
    profile: cylinderProfile,
    segments: CYLINDER_SEGMENTS,
  });
  TestValidator.equals(
    "a revolved surface carries one uv pair per vertex",
    {
      pairs: tube.uvs?.length,
      vertices: (tube.positions.length / 3) * 2,
    },
    {
      pairs: (CYLINDER_SEGMENTS + 1) * cylinderProfile.length * 2,
      vertices: (CYLINDER_SEGMENTS + 1) * cylinderProfile.length * 2,
    },
  );

  const circumference = 2 * Math.PI * CYLINDER_RADIUS;
  const closing = CYLINDER_SEGMENTS * cylinderProfile.length;
  TestValidator.equals(
    "the seam cut spans the true circumference, in metres of arc",
    namedFacts([
      ["firstRing", () => nclose(uvAt(tube.uvs!, 0).u, circumference)],
      ["closingRing", () => nclose(uvAt(tube.uvs!, closing).u, 0)],
      [
        "quarterTurn",
        () =>
          nclose(
            uvAt(tube.uvs!, cylinderProfile.length).u,
            circumference - Math.PI / 2,
          ),
      ],
      ["notNormalized", () => uvAt(tube.uvs!, 0).u > 1],
      [
        "phaseIsACut",
        () =>
          nclose(uvAt(tube.uvs!, closing).u, uvAt(tube.uvs!, 0).u) === false,
      ],
    ]),
    {
      firstRing: true,
      closingRing: true,
      quarterTurn: true,
      notNormalized: true,
      phaseIsACut: true,
    },
  );

  TestValidator.equals(
    "along is the meridian's own length, in metres",
    namedFacts([
      ["foot", () => nclose(uvAt(tube.uvs!, 0).v, 0)],
      ["head", () => nclose(uvAt(tube.uvs!, 1).v, CYLINDER_HEIGHT)],
      [
        "sameAtEverySegment",
        () =>
          Array.from({ length: CYLINDER_SEGMENTS + 1 }, (_ring, segment) =>
            nclose(
              uvAt(tube.uvs!, segment * cylinderProfile.length + 1).v,
              CYLINDER_HEIGHT,
            ),
          ).every((level) => level),
      ],
    ]),
    { foot: true, head: true, sameAtEverySegment: true },
  );

  // A cone standing on its point: the meridian rises 1 m while the radius opens
  // 1 m, so its slant is sqrt(2) and its first point sits on the axis.
  const cone = revolveAutoMovieProfile({
    profile: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    segments: 6,
  });
  TestValidator.equals(
    "a cone measures slant as slant, and its pole has no arc to travel",
    namedFacts([
      ["slant", () => nclose(uvAt(cone.uvs!, 1).v, Math.SQRT2)],
      [
        "poleRing",
        () =>
          Array.from({ length: 7 }, (_ring, segment) =>
            nclose(uvAt(cone.uvs!, segment * 2).u, 0),
          ).every((flat) => flat),
      ],
      ["rimStart", () => nclose(uvAt(cone.uvs!, 1).u, 2 * Math.PI)],
      ["rimHalfTurn", () => nclose(uvAt(cone.uvs!, 3 * 2 + 1).u, Math.PI)],
      ["rimFullTurn", () => nclose(uvAt(cone.uvs!, 6 * 2 + 1).u, 0)],
    ]),
    {
      slant: true,
      poleRing: true,
      rimStart: true,
      rimHalfTurn: true,
      rimFullTurn: true,
    },
  );

  TestValidator.equals(
    "a pole keeps finite coordinates on declared degenerates; an open tube has none",
    {
      coneDegenerates: inspectAutoMovieMeshTopology(cone).degenerate,
      coneUvsFinite: cone.uvs!.every(Number.isFinite),
      tubeDegenerates: inspectAutoMovieMeshTopology(tube).degenerate,
    },
    { coneDegenerates: 6, coneUvsFinite: true, tubeDegenerates: 0 },
  );

  const plate = extrudeAutoMovieRegion({
    outer: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    depth: 0.1,
  });
  const panel = buildAutoMovieWall({
    width: 1,
    height: 1,
    depth: 0.1,
    openings: [],
  });
  TestValidator.equals(
    "a merge keeps coordinates only when every member carries them",
    {
      withBearer:
        mergeAutoMovieMeshes([tube, plate]).uvs?.length ===
        tube.uvs!.length + plate.uvs!.length,
      withoutBearer: mergeAutoMovieMeshes([tube, panel]).uvs,
    },
    { withBearer: true, withoutBearer: null },
  );

  TestValidator.equals(
    "the same authored meridian rebuilds byte-identically",
    JSON.stringify(
      revolveAutoMovieProfile({
        profile: cylinderProfile,
        segments: CYLINDER_SEGMENTS,
      }),
    ),
    JSON.stringify(tube),
  );
};
