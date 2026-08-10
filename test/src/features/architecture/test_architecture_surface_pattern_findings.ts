import {
  type AutoMovieSurfacePatternGenerator,
  generateAutoMovieSurfacePattern,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { pattern, rectangle, zone } from "../internal/patternFixtures";
import { namedFacts, nclose } from "../internal/predicates";

/** One course of modules, laid only on the lattice row through the region. */
const course =
  (
    size: number,
    grainDeg: number,
    height: number,
  ): AutoMovieSurfacePatternGenerator =>
  ({ column, row, origin, period }) =>
    row !== 0
      ? []
      : [
          {
            id: `c${column}`,
            center: { u: origin.u + period.u / 2, v: height / 2 },
            size: { u: size, v: height },
            rotationDeg: 0,
            grainDeg,
          },
        ];

/**
 * The three neighbour defects a laid pattern reports, and the transition where
 * one zone meets another.
 *
 * A joint is read perpendicular to the edges it separates, so two modules that
 * overlap, that sit further apart than the joint allows, or that run their
 * grain in different directions are all measured the same way and reported as
 * structured findings rather than as a render that looks wrong. Neighbours are
 * whatever falls inside the declared adjacency gap, which is what lets the same
 * scan report across a zone border and inside one zone with no second rule.
 *
 * Scenarios:
 *
 * 1. Modules laid wider than their pitch overlap; every overlapping pair is
 *    reported with the metre penetration, and pairs beyond the adjacency gap
 *    are not reported at all.
 * 2. Two zones whose modules the shared border cuts butt against each other on the
 *    surface, so nothing is reported, even though the two modules as designed
 *    occupy exactly the same rectangle. This is why neighbours are measured
 *    between the pieces as laid rather than the modules as designed.
 * 3. A course whose middle module is 40 mm narrower opens both its joints to 40 mm
 *    against a 20 mm nominal, so both pairs are reported; a course laid to the
 *    nominal reports nothing.
 * 4. When the same neighbouring pair also turns its grain, the joint finding and
 *    the grain finding are both raised, in that order.
 * 5. Two zones meeting at a shared edge report the grain turn across the border
 *    and stay silent inside each zone.
 * 6. A null grain tolerance disables the grain scan entirely, even where the grain
 *    turns ninety degrees.
 */
export const test_architecture_surface_pattern_findings = (): void => {
  const overlapping = generateAutoMovieSurfacePattern({
    pattern: pattern({
      id: "overlap",
      zones: [
        zone({
          id: "bad",
          region: rectangle(-0.1, 0, 2.1, 0.6),
          period: { u: 0.5, v: 2 },
          reach: { u: 0.6, v: 0.6 },
          generate: ({ column, row, origin }) =>
            row !== 0
              ? []
              : [
                  {
                    id: `m${column}`,
                    center: { u: origin.u + 0.25, v: 0.3 },
                    size: { u: 0.6, v: 0.6 },
                    rotationDeg: 0,
                    grainDeg: 0,
                  },
                ],
        }),
      ],
      adjacency: 0.05,
      minimumPiece: 0.05,
    }),
  });
  TestValidator.equals(
    "every overlapping neighbour pair is reported, and no distant pair is",
    overlapping.findings.map((one) => one.occurrences.join("+")),
    [
      "bad/m-1+bad/m0",
      "bad/m0+bad/m1",
      "bad/m1+bad/m2",
      "bad/m2+bad/m3",
      "bad/m3+bad/m4",
    ],
  );
  TestValidator.equals(
    "an overlap reports the metre penetration against a zero limit",
    namedFacts([
      [
        "kinds",
        () =>
          overlapping.findings.every((one) => one.kind === "module-overlap"),
      ],
      [
        "measured",
        () =>
          overlapping.findings.every((one) => nclose(one.measured, -0.1, 1e-9)),
      ],
      ["limit", () => overlapping.findings.every((one) => one.limit === 0)],
      [
        "detail",
        () =>
          overlapping.findings[0]!.detail.includes(
            "instead of leaving a joint",
          ),
      ],
      ["placements", () => overlapping.placements.length === 6],
      [
        "outside",
        () =>
          overlapping.placements.map((one) => one.module).join() ===
          "m-1,m0,m1,m2,m3,m4",
      ],
    ]),
    {
      kinds: true,
      measured: true,
      limit: true,
      detail: true,
      placements: true,
      outside: true,
    },
  );

  const straddle = zone({
    period: { u: 1, v: 1 },
    reach: { u: 0.6, v: 0.6 },
    generate: ({ column, row, origin }) =>
      row !== 0
        ? []
        : [
            {
              id: `c${column}`,
              center: { u: origin.u, v: 0.25 },
              size: { u: 1, v: 0.5 },
              rotationDeg: 0,
              grainDeg: 0,
            },
          ],
  });
  const shared = generateAutoMovieSurfacePattern({
    pattern: pattern({
      id: "border",
      zones: [
        { ...straddle, id: "a", region: rectangle(0, 0, 1, 0.5) },
        {
          ...straddle,
          id: "b",
          region: rectangle(1, 0, 2, 0.5),
          origin: { u: 1, v: 0 },
        },
      ],
      minimumPiece: 0.5,
    }),
  });
  TestValidator.equals(
    "pieces cut at a shared border butt on the surface and report nothing",
    namedFacts([
      [
        "placements",
        () =>
          shared.placements.map((one) => one.id).join() ===
          "a/c0,a/c1,b/c0,b/c1",
      ],
      [
        "sameRectangle",
        () =>
          nclose(shared.placements[1]!.center.u, 1, 1e-12) &&
          nclose(shared.placements[2]!.center.u, 1, 1e-12) &&
          nclose(shared.placements[1]!.size.u, 1, 1e-12) &&
          nclose(shared.placements[2]!.size.u, 1, 1e-12),
      ],
      [
        "cutAtBorder",
        () => shared.placements.every((one) => one.cut === "boundary"),
      ],
      ["findings", () => shared.findings.length === 0],
    ]),
    {
      placements: true,
      sameRectangle: true,
      cutAtBorder: true,
      findings: true,
    },
  );

  const onCorner = (joint: number, jointTolerance: number, adjacency: number) =>
    generateAutoMovieSurfacePattern({
      pattern: pattern({
        id: "corner",
        zones: [
          zone({
            id: "tri",
            region: [
              { u: 0, v: 0 },
              { u: 2, v: 0 },
              { u: 0, v: 2 },
            ],
            origin: { u: 0.5, v: 0.5 },
            period: { u: 1, v: 1 },
            reach: { u: 1, v: 1 },
            generate: ({ column, row, origin }) =>
              row !== 0 || column < -1 || column > 0
                ? []
                : [
                    {
                      id: `m${column}`,
                      center: { u: origin.u + 0.5, v: origin.v + 0.5 },
                      size: { u: 1, v: 1 },
                      rotationDeg: 0,
                      grainDeg: 0,
                    },
                  ],
          }),
        ],
        joint,
        jointTolerance,
        adjacency,
        minimumPiece: 0.5,
      }),
    });
  const cornered = onCorner(0, 0, 0);
  TestValidator.equals(
    "a corner landing exactly on a clip edge is kept once, not twice",
    namedFacts([
      ["placements", () => cornered.placements.length === 2],
      ["triangle", () => cornered.placements[1]!.outline.length === 3],
      [
        "distinct",
        () =>
          cornered.placements.every((one) =>
            one.outline.every(
              (point, index) =>
                point.u !== one.outline[(index + 1) % one.outline.length]!.u ||
                point.v !== one.outline[(index + 1) % one.outline.length]!.v,
            ),
          ),
      ],
      [
        "areas",
        () => cornered.placements.every((one) => nclose(one.area, 0.5, 1e-12)),
      ],
      [
        "coverage",
        () =>
          cornered.placements.every((one) => nclose(one.coverage, 0.5, 1e-12)),
      ],
      ["findings", () => cornered.findings.length === 0],
    ]),
    {
      placements: true,
      triangle: true,
      distinct: true,
      areas: true,
      coverage: true,
      findings: true,
    },
  );
  const cornerJoint = onCorner(0.02, 0.001, 0.05);
  TestValidator.equals(
    "the two pieces are still measured against each other, not skipped as NaN",
    cornerJoint.findings.map(
      (one) => `${one.kind}:${one.occurrences.join("+")}`,
    ),
    ["joint-deviation:tri/m-1+tri/m0"],
  );
  TestValidator.equals(
    "and the measurement is the real zero-metre butt joint",
    namedFacts([
      ["measured", () => cornerJoint.findings[0]!.measured === 0],
      ["limit", () => nclose(cornerJoint.findings[0]!.limit, 0.02, 1e-12)],
    ]),
    { measured: true, limit: true },
  );

  const run = (narrow: boolean, grainToleranceDeg: number | null) =>
    generateAutoMovieSurfacePattern({
      pattern: pattern({
        id: "course",
        zones: [
          zone({
            id: "band",
            region: rectangle(0, 0, 3, 0.5),
            period: { u: 1, v: 2 },
            reach: { u: 1, v: 0.5 },
            generate: ({ column, row, origin }) =>
              row !== 0
                ? []
                : [
                    {
                      id: `c${column}`,
                      center: { u: origin.u + 0.5, v: 0.25 },
                      size: {
                        u: narrow && column === 1 ? 0.94 : 0.98,
                        v: 0.5,
                      },
                      rotationDeg: 0,
                      grainDeg:
                        grainToleranceDeg !== null && column === 1 ? 90 : 0,
                    },
                  ],
          }),
        ],
        joint: 0.02,
        jointTolerance: 0.005,
        adjacency: 0.1,
        minimumPiece: 0.5,
        grainToleranceDeg,
      }),
    });

  const opened = run(true, null);
  TestValidator.equals(
    "a narrower module opens both of its joints beyond the tolerance",
    namedFacts([
      ["placements", () => opened.placements.length === 3],
      ["count", () => opened.findings.length === 2],
      [
        "kinds",
        () => opened.findings.every((one) => one.kind === "joint-deviation"),
      ],
      [
        "pairs",
        () =>
          opened.findings.map((one) => one.occurrences.join("+")).join() ===
          "band/c0+band/c1,band/c1+band/c2",
      ],
      [
        "measured",
        () => opened.findings.every((one) => nclose(one.measured, 0.04, 1e-9)),
      ],
      [
        "limit",
        () => opened.findings.every((one) => nclose(one.limit, 0.02, 1e-12)),
      ],
    ]),
    {
      placements: true,
      count: true,
      kinds: true,
      pairs: true,
      measured: true,
      limit: true,
    },
  );

  TestValidator.equals(
    "a course laid to the nominal joint reports nothing",
    run(false, null).findings.length,
    0,
  );

  const turned = run(true, 5);
  TestValidator.equals(
    "a pair that deviates in joint and grain raises both, joint first",
    turned.findings.map((one) => `${one.kind}:${one.occurrences.join("+")}`),
    [
      "joint-deviation:band/c0+band/c1",
      "grain-break:band/c0+band/c1",
      "joint-deviation:band/c1+band/c2",
      "grain-break:band/c1+band/c2",
    ],
  );
  TestValidator.equals(
    "a grain break reports the smallest angle between the two directions",
    namedFacts([
      ["measured", () => nclose(turned.findings[1]!.measured, 90, 1e-12)],
      ["limit", () => nclose(turned.findings[1]!.limit, 5, 1e-12)],
      ["detail", () => turned.findings[1]!.detail.includes("run their grain")],
    ]),
    { measured: true, limit: true, detail: true },
  );

  const transition = (grainToleranceDeg: number | null) =>
    generateAutoMovieSurfacePattern({
      pattern: pattern({
        id: "transition",
        zones: [
          zone({
            id: "a",
            region: rectangle(0, 0, 1, 0.5),
            period: { u: 0.5, v: 1 },
            generate: course(0.5, 0, 0.5),
          }),
          zone({
            id: "b",
            region: rectangle(1, 0, 2, 0.5),
            origin: { u: 1, v: 0 },
            period: { u: 0.5, v: 1 },
            generate: course(0.5, 90, 0.5),
          }),
        ],
        grainToleranceDeg,
        minimumPiece: 0.5,
      }),
    });
  const across = transition(5);
  TestValidator.equals(
    "the grain turn is reported across the zone border and nowhere else",
    across.findings.map((one) => `${one.kind}:${one.occurrences.join("+")}`),
    ["grain-break:a/c1+b/c0"],
  );
  TestValidator.equals(
    "the transition still lays both zones in full",
    across.placements.map((one) => one.id),
    ["a/c0", "a/c1", "b/c0", "b/c1"],
  );
  TestValidator.equals(
    "a null grain tolerance disables the grain scan entirely",
    transition(null).findings.length,
    0,
  );
};
