import {
  IAutoMovieLoftSection,
  inspectAutoMovieMeshTopology,
  loftAutoMovieSections,
  sweepAutoMovieProfile,
  validateMeshTopology,
} from "@automovie/engine";
import { IAutoMovieMesh, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

const ell = [
  { x: 0, y: 0 },
  { x: 3, y: 0 },
  { x: 3, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 3 },
  { x: 0, y: 3 },
];

const box = (half: number): Array<{ x: number; y: number }> => [
  { x: -half, y: -half },
  { x: half, y: -half },
  { x: half, y: half },
  { x: -half, y: half },
];

const constant = (
  outer: ReturnType<typeof box>,
  holes?: Array<ReturnType<typeof box>>,
): IAutoMovieLoftSection[] => [
  { at: 0, outer, holes },
  { at: 1, outer, holes },
];

const straight = (length: number): IAutoMovieVector3[] => [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 0, z: length },
];

/** A closed solid measured two ways: by its own topology and by the validator. */
const closes = (mesh: IAutoMovieMesh, volume: number): boolean => {
  const topology = inspectAutoMovieMeshTopology(mesh);
  return (
    topology.watertight &&
    topology.degenerate === 0 &&
    topology.nonFinite === 0 &&
    validateMeshTopology({ mesh, expectClosed: true }).success &&
    nclose(topology.volume, volume, 1e-12)
  );
};

const carries = (mesh: IAutoMovieMesh, corner: IAutoMovieVector3): boolean => {
  for (let at = 0; at < mesh.positions.length; at += 3)
    if (
      mesh.positions[at] === corner.x &&
      mesh.positions[at + 1] === corner.y &&
      mesh.positions[at + 2] === corner.z
    )
      return true;
  return false;
};

/** The frustum of a pyramid: `h / 3 * (A + B + sqrt(A * B))`. */
const frustum = (near: number, far: number, height: number): number =>
  (height / 3) * (near + far + Math.sqrt(near * far));

/**
 * Lofting free-form sections along a path: the variable section, the taper, and
 * the concave or hollow sweep the convex sweep cannot carry.
 *
 * Every volume is closed-form. A 2 m square tapering to a 1 m square over 3 m
 * is a pyramid frustum of 7 m³; a square waisted to half width and back over 2
 * m is two frusta of 7/3 m³; an L section carried unchanged is a prism of its
 * own area. The one solid whose volume has no elementary closed form, a mitred
 * bend, is pinned against `sweepAutoMovieProfile` instead, because the two
 * share one frame rule and a bend that mitres volume away must do so
 * identically in both.
 *
 * Scenarios:
 *
 * 1. A concave L section and a hollow section each loft to a closed prism of the
 *    section's own area times the path length, which is the concave and holed
 *    sweep the convex path refuses outright.
 * 2. A taper between two sections is a pyramid frustum to the last digit, and a
 *    section waisted at a declared midpoint is two of them.
 * 3. A station between two declared sections carries the blend: the midpoint of a
 *    1 m and a 2 m half-width is a 1.5 m half-width corner in the buffer, and
 *    the volume is the two frusta that implies.
 * 4. Regression against the sweep: a loft whose two sections are the same convex
 *    profile traces the sweep's solid on a straight path, a right-angle bend,
 *    and a path that turns in all three axes.
 * 5. Determinism: the same authored loft rebuilds byte-identically.
 * 6. Negative twins: every guard refuses one property away from a loft that
 *    builds, covering the path, the station fractions, the ring counts, the
 *    point counts, the winding, and the ring shapes.
 */
export const test_geometry_loft_sections = (): void => {
  const carried = loftAutoMovieSections({
    path: straight(2),
    sections: [
      { at: 0, outer: ell },
      { at: 1, outer: ell },
    ],
  });
  const hollow = loftAutoMovieSections({
    path: straight(4),
    sections: constant(box(1), [box(0.5)]),
  });
  TestValidator.equals(
    "a concave section and a hollow one each loft to a prism of their own area",
    namedFacts([
      ["concave", () => closes(carried, 5 * 2)],
      ["concaveIndices", () => carried.indices!.length === (4 * 2 + 6 * 2) * 3],
      ["hollow", () => closes(hollow, (2 * 2 - 1 * 1) * 4)],
      ["hollowIndices", () => hollow.indices!.length === (8 * 2 + 8 * 2) * 3],
    ]),
    {
      concave: true,
      concaveIndices: true,
      hollow: true,
      hollowIndices: true,
    },
  );

  const taper = loftAutoMovieSections({
    path: straight(3),
    sections: [
      { at: 0, outer: box(1) },
      { at: 1, outer: box(0.5) },
    ],
  });
  const waisted = loftAutoMovieSections({
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
    ],
    sections: [
      { at: 0, outer: box(1) },
      { at: 0.5, outer: box(0.5) },
      { at: 1, outer: box(1) },
    ],
  });
  TestValidator.equals(
    "a taper and a waisted section are frusta to the last digit",
    namedFacts([
      ["taper", () => closes(taper, frustum(4, 1, 3))],
      ["taperVolume", () => nclose(frustum(4, 1, 3), 7, 1e-15)],
      ["waisted", () => closes(waisted, frustum(4, 1, 1) + frustum(1, 4, 1))],
      ["waistedVolume", () => nclose(frustum(4, 1, 1) * 2, 14 / 3, 1e-15)],
    ]),
    {
      taper: true,
      taperVolume: true,
      waisted: true,
      waistedVolume: true,
    },
  );

  const blended = loftAutoMovieSections({
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 2 },
    ],
    sections: [
      { at: 0, outer: box(1) },
      { at: 1, outer: box(2) },
    ],
  });
  TestValidator.equals(
    "a station between two declared sections carries their blend",
    namedFacts([
      ["corner", () => carries(blended, { x: 1.5, y: 1.5, z: 1 })],
      ["opposite", () => carries(blended, { x: -1.5, y: -1.5, z: 1 })],
      ["notTheNear", () => carries(blended, { x: 1, y: 1, z: 1 }) === false],
      ["notTheFar", () => carries(blended, { x: 2, y: 2, z: 1 }) === false],
      ["volume", () => closes(blended, frustum(4, 9, 1) + frustum(9, 16, 1))],
      [
        "oracle",
        () => nclose(frustum(4, 9, 1) + frustum(9, 16, 1), 56 / 3, 1e-14),
      ],
    ]),
    {
      corner: true,
      opposite: true,
      notTheNear: true,
      notTheFar: true,
      volume: true,
      oracle: true,
    },
  );

  const profile = box(0.1);
  const paths: IAutoMovieVector3[][] = [
    straight(2),
    [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 2, y: 2, z: 0 },
    ],
    [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 3, z: 1 },
      { x: 2, y: 3, z: 4 },
    ],
  ];
  TestValidator.equals(
    "a loft of one repeated convex section traces the solid the sweep traces",
    paths.map((path) => {
      const lofted = loftAutoMovieSections({
        path,
        sections: constant(profile),
      });
      const topology = inspectAutoMovieMeshTopology(lofted);
      return namedFacts([
        [
          "volume",
          () =>
            nclose(
              topology.volume,
              inspectAutoMovieMeshTopology(
                sweepAutoMovieProfile({ profile, path }),
              ).volume,
              1e-12,
            ),
        ],
        ["closed", () => topology.watertight],
        [
          "topology",
          () =>
            validateMeshTopology({ mesh: lofted, expectClosed: true }).success,
        ],
      ]);
    }),
    paths.map(() => ({ volume: true, closed: true, topology: true })),
  );

  TestValidator.equals(
    "the same authored loft rebuilds byte-identically",
    JSON.stringify(
      loftAutoMovieSections({
        path: straight(4),
        sections: constant(box(1), [box(0.5)]),
      }),
    ),
    JSON.stringify(hollow),
  );

  const twin = (
    outer: Array<{ x: number; y: number }>,
  ): IAutoMovieLoftSection[] => [
    { at: 0, outer: ell },
    { at: 1, outer },
  ];
  const invalids: Array<readonly [string, () => unknown, string]> = [
    [
      "short path",
      () =>
        loftAutoMovieSections({
          path: [{ x: 0, y: 0, z: 0 }],
          sections: twin(ell),
        }),
      "loft path needs at least two points",
    ],
    [
      "non-finite path",
      () =>
        loftAutoMovieSections({
          path: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: Number.NaN, z: 1 },
          ],
          sections: twin(ell),
        }),
      "loft path[1] must be finite",
    ],
    [
      // Distinct neighbours are not enough: a path that doubles back leaves the
      // centred tangent at the fold with no direction at all.
      "path folding back on itself",
      () =>
        loftAutoMovieSections({
          path: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
          ],
          sections: twin(ell),
        }),
      "loft path around point 1 is degenerate",
    ],
    [
      "repeated path point",
      () =>
        loftAutoMovieSections({
          path: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
          ],
          sections: twin(ell),
        }),
      "loft path[1] repeats the point beside it",
    ],
    [
      "one section",
      () =>
        loftAutoMovieSections({
          path: straight(1),
          sections: [{ at: 0, outer: ell }],
        }),
      "loft needs at least two sections",
    ],
    [
      "non-finite station",
      () =>
        loftAutoMovieSections({
          path: straight(1),
          sections: [
            { at: Number.NaN, outer: ell },
            { at: 1, outer: ell },
          ],
        }),
      "loft section[0] at must be finite",
    ],
    [
      "station not increasing",
      () =>
        loftAutoMovieSections({
          path: straight(1),
          sections: [
            { at: 0, outer: ell },
            { at: 0, outer: ell },
            { at: 1, outer: ell },
          ],
        }),
      "loft section[1] at must be greater than section[0] at",
    ],
    [
      "stations not spanning",
      () =>
        loftAutoMovieSections({
          path: straight(1),
          sections: [
            { at: 0, outer: ell },
            { at: 0.5, outer: ell },
          ],
        }),
      "loft sections must run from at 0 to at 1",
    ],
    [
      "ring count",
      () =>
        loftAutoMovieSections({
          path: straight(1),
          sections: [
            { at: 0, outer: ell },
            {
              at: 1,
              outer: ell,
              holes: [
                [
                  { x: 0.2, y: 0.2 },
                  { x: 0.6, y: 0.2 },
                  { x: 0.6, y: 0.6 },
                  { x: 0.2, y: 0.6 },
                ],
              ],
            },
          ],
        }),
      "loft section[1] must declare the same 1 rings as section[0]",
    ],
    [
      "point count",
      () =>
        loftAutoMovieSections({
          path: straight(1),
          sections: twin([
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ]),
        }),
      "loft section[1] ring[0] must carry the same 6 points as section[0]",
    ],
    [
      "winding",
      () =>
        loftAutoMovieSections({
          path: straight(1),
          sections: twin([...ell].reverse()),
        }),
      "loft section[1] ring[0] must wind the same way as section[0]",
    ],
    [
      "section ring shape",
      () =>
        loftAutoMovieSections({
          path: straight(1),
          sections: twin([
            { x: 0, y: 0 },
            { x: 4, y: 4 },
            { x: 4, y: 0 },
            { x: 0, y: 3 },
            { x: 0, y: 1 },
            { x: 0, y: 2 },
          ]),
        }),
      "loft section[1] outer ring[4] doubles back along its own edge",
    ],
  ];
  for (const [name, callback, message] of invalids)
    TestValidator.predicate(
      `${name} is refused by its own diagnostic`,
      throwsError(callback, message),
    );
};
