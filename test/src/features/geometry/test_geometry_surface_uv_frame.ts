import { buildAutoMoviePolyhedron } from "@automovie/engine";
import { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** The uv pair the vertex at `at` carries. */
const uvAt = (
  uvs: readonly number[],
  at: number,
): { u: number; v: number } => ({ u: uvs[at * 2]!, v: uvs[at * 2 + 1]! });

/** One upright face on the plane `z = 0`, seen from +Z. */
const uprightFace = [
  { x: 0, y: 0, z: 0 },
  { x: 4, y: 0, z: 0 },
  { x: 4, y: 3, z: 0 },
  { x: 0, y: 3, z: 0 },
];

/** One level face on the plane `y = 0`, seen from +Y. */
const levelFace = [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: 2 },
  { x: 5, y: 0, z: 2 },
  { x: 5, y: 0, z: 0 },
];

/**
 * One rectangular face's frame read back as the images of its two edges: their
 * lengths in the atlas and the angle between them.
 *
 * An orthonormal in-plane frame carries an edge of `d` metres to a displacement
 * of `d` units and keeps two perpendicular edges perpendicular. Measuring it
 * this way rather than by re-deriving the axes is what keeps the check an
 * independent one: a second copy of the frame rule would agree with a wrong
 * rule as readily as with a right one.
 */
const isometric = (mesh: IAutoMovieMesh): boolean => {
  const uvs = mesh.uvs!;
  const corner = (at: number): readonly [number, number, number] => [
    mesh.positions[at * 3]!,
    mesh.positions[at * 3 + 1]!,
    mesh.positions[at * 3 + 2]!,
  ];
  const origin = uvAt(uvs, 0);
  const first = uvAt(uvs, 1);
  const last = uvAt(uvs, 3);
  const firstU = first.u - origin.u;
  const firstV = first.v - origin.v;
  const lastU = last.u - origin.u;
  const lastV = last.v - origin.v;
  const span = (at: number): number => {
    const [ax, ay, az] = corner(0);
    const [bx, by, bz] = corner(at);
    return Math.hypot(bx - ax, by - ay, bz - az);
  };
  return (
    nclose(Math.hypot(firstU, firstV), span(1)) &&
    nclose(Math.hypot(lastU, lastV), span(3)) &&
    nclose(firstU * lastU + firstV * lastV, 0)
  );
};

/**
 * The metre frame a polyhedron face measures its texture coordinates in, taken
 * from the face's own normal.
 *
 * Every expected number here is read off the frame rule rather than off the
 * builder. An upright face takes world up as V and the remaining in-plane axis
 * as U, so a corner at height `y` reads `v = y` on every upright face in the
 * mesh. A level face has no up to project and falls back to world +X as U, and
 * the cross product then carries a floor and a ceiling to opposite V. Both
 * branches must stay orthonormal, because that is what makes a metre on the
 * face one unit in the atlas and keeps the frame from squeezing the image on
 * its own.
 *
 * Scenarios:
 *
 * 1. A face on `z = 0` facing +Z reads `u = x` and `v = y` at every corner: V is
 *    world up projected into the plane, U is `v x n`, and the origin is the mesh
 *    origin rather than the face's first corner.
 * 2. The same face translated 10 m along +X reads `u = x + 10`, so the frame is
 *    anchored on the mesh and the coordinate is a function of position.
 * 3. A face on `x = 0` facing +X reads `v = y` still and `u = -z`, which is the
 *    upright rule's second axis and the reason coursing survives a corner.
 * 4. A level face facing +Y reads `u = x` and `v = -z`; the same outline wound
 *    the other way faces -Y and reads `v = +z`, the mirror a ceiling needs to
 *    read the right way round from below.
 * 5. A face tilted 45 degrees measures its slope in metres of slope, not of
 *    plan: a corner 1 m up a 45 degree ramp reads `v = sqrt(2)`, so the atlas
 *    stays isometric on the face instead of being foreshortened.
 * 6. Every branch of the frame carries a metre to a unit and keeps perpendicular
 *    edges perpendicular.
 * 7. The level-frame threshold has adjacent boundary twins: a face tilted
 *    0.029 degrees uses the level branch, one tilted 0.115 degrees uses the
 *    upright branch, and both remain finite and isometric across the declared
 *    orientation seam.
 */
export const test_geometry_surface_uv_frame = (): void => {
  const upright = buildAutoMoviePolyhedron([uprightFace]);
  TestValidator.equals(
    "an upright face takes world up as V and the mesh origin as its origin",
    upright.uvs,
    [0, 0, 4, 0, 4, 3, 0, 3],
  );

  const moved = buildAutoMoviePolyhedron([
    uprightFace.map((corner) => ({ ...corner, x: corner.x + 10 })),
  ]);
  TestValidator.equals(
    "the frame is anchored on the mesh, so moving the face moves its coordinates",
    moved.uvs,
    [10, 0, 14, 0, 14, 3, 10, 3],
  );

  // Wound counter-clockwise seen from +X, so the outward normal is +X: V stays
  // world up and U is `cross(up, +X) = -Z`.
  const sideward = buildAutoMoviePolyhedron([
    [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -4 },
      { x: 0, y: 3, z: -4 },
      { x: 0, y: 3, z: 0 },
    ],
  ]);
  TestValidator.equals(
    "an upright face facing +X keeps V on height and puts U on -Z",
    sideward.uvs,
    [0, 0, 4, 0, 4, 3, 0, 3],
  );

  const floor = buildAutoMoviePolyhedron([levelFace]);
  const ceiling = buildAutoMoviePolyhedron([[...levelFace].reverse()]);
  TestValidator.equals(
    "a level face falls back to world +X as U, and its mirror flips V",
    { floor: floor.uvs, ceiling: ceiling.uvs },
    { floor: [0, 0, 0, -2, 5, -2, 5, 0], ceiling: [5, 0, 5, 2, 0, 2, 0, 0] },
  );

  // A ramp rising 1 m over 1 m along -Z, wound so its outward normal leans +Y
  // and +Z: V is world up projected onto the slope, which advances by the slope
  // distance sqrt(2) over that rise rather than by the 1 m of plan.
  const ramp = buildAutoMoviePolyhedron([
    [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 1, z: -1 },
      { x: 0, y: 1, z: -1 },
    ],
  ]);
  TestValidator.equals(
    "a 45 degree face measures its slope in metres of slope, not of plan",
    namedFacts([
      ["footU", () => nclose(uvAt(ramp.uvs!, 0).u, 0)],
      ["footV", () => nclose(uvAt(ramp.uvs!, 0).v, 0)],
      ["crestU", () => nclose(uvAt(ramp.uvs!, 2).u, 2)],
      ["crestV", () => nclose(uvAt(ramp.uvs!, 2).v, Math.SQRT2)],
      ["risePerPlan", () => nclose(uvAt(ramp.uvs!, 3).v, Math.SQRT2)],
    ]),
    {
      footU: true,
      footV: true,
      crestU: true,
      crestV: true,
      risePerPlan: true,
    },
  );

  TestValidator.equals(
    "every branch of the frame carries a metre on the face to one unit",
    namedFacts([
      ["upright", () => isometric(upright)],
      ["sideward", () => isometric(sideward)],
      ["floor", () => isometric(floor)],
      ["ceiling", () => isometric(ceiling)],
      ["ramp", () => isometric(ramp)],
    ]),
    {
      upright: true,
      sideward: true,
      floor: true,
      ceiling: true,
      ramp: true,
    },
  );

  const nearlyLevel = (slope: number): IAutoMovieMesh =>
    buildAutoMoviePolyhedron([
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: slope, z: 0 },
        { x: 1, y: slope, z: 1 },
        { x: 0, y: 0, z: 1 },
      ],
    ]);
  const levelSide = nearlyLevel(0.0005);
  const uprightSide = nearlyLevel(0.002);
  TestValidator.equals(
    "the near-level orientation seam keeps both boundary twins finite and metric",
    namedFacts([
      ["levelFinite", () => levelSide.uvs!.every(Number.isFinite)],
      ["uprightFinite", () => uprightSide.uvs!.every(Number.isFinite)],
      ["levelMetric", () => isometric(levelSide)],
      ["uprightMetric", () => isometric(uprightSide)],
      [
        "oppositeFrames",
        () =>
          nclose(uvAt(levelSide.uvs!, 1).u, Math.hypot(1, 0.0005)) &&
          nclose(uvAt(uprightSide.uvs!, 1).u, 0) &&
          nclose(uvAt(uprightSide.uvs!, 1).v, Math.hypot(1, 0.002)),
      ],
    ]),
    {
      levelFinite: true,
      uprightFinite: true,
      levelMetric: true,
      uprightMetric: true,
      oppositeFrames: true,
    },
  );
};
