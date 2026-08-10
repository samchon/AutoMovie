import {
  type IAutoMovieSurfacePattern,
  generateAutoMovieSurfacePattern,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  pattern,
  rectangle,
  stackBond,
  zone,
} from "../internal/patternFixtures";
import { namedFacts, throwsError } from "../internal/predicates";

const refuses = (
  overrides: Partial<IAutoMovieSurfacePattern>,
  message: string | readonly string[],
): boolean =>
  throwsError(
    () => generateAutoMovieSurfacePattern({ pattern: pattern(overrides) }),
    message,
  );

/**
 * Every input a pattern run refuses, each beside the value one step away that
 * it accepts.
 *
 * A pattern that quietly repairs its declaration produces a take-off nobody can
 * trust: a self-overlapping region double-counts area, a module that reaches
 * further than declared vanishes at the region's edge instead of being laid,
 * and two zones that overlap cover the same square metre twice. Every one of
 * those is refused with a message naming the declaration that caused it.
 *
 * Scenarios:
 *
 * 1. Envelope scalars are refused one at a time: blank id, no zones, negative
 *    joint, negative tolerance, negative adjacency, a minimum piece outside
 *    `(0, 1]`, a negative grain tolerance, a seed that is not a non-negative
 *    safe integer, and a variant count below one.
 * 2. Zone identity and lattice are refused: a blank id, a duplicate id, a
 *    non-finite origin, a non-positive period, and a non-positive reach.
 * 3. Regions are refused: a non-finite corner, three collinear points that enclose
 *    no area, and a polygon with a reflex corner or an interior point.
 * 4. Two zones covering the same area are refused, and two zones sharing only an
 *    edge are not.
 * 5. Exclusions are refused: a blank id, a duplicate id, a non-convex polygon, and
 *    two exclusions that overlap. Two exclusions that only touch are not.
 * 6. Generated modules are refused: a blank id, an id repeated across cells, a
 *    non-finite centre, a non-positive size, a non-finite rotation or grain,
 *    and a module reaching further from its cell origin than the zone
 *    declared.
 * 7. A lattice larger than the cell limit is refused before it is walked.
 */
export const test_architecture_surface_pattern_refusals = (): void => {
  TestValidator.equals(
    "envelope scalars are refused one at a time",
    namedFacts([
      ["id", () => refuses({ id: " " }, "pattern id must be non-empty")],
      [
        "zones",
        () =>
          refuses({ zones: [] }, "a surface pattern needs at least one zone"),
      ],
      [
        "joint",
        () =>
          refuses(
            { joint: -1e-9 },
            "pattern joint must be a finite number >= 0",
          ),
      ],
      [
        "tolerance",
        () =>
          refuses(
            { jointTolerance: Number.NaN },
            "pattern joint tolerance must be a finite number >= 0",
          ),
      ],
      [
        "adjacency",
        () =>
          refuses(
            { adjacency: -1 },
            "pattern adjacency must be a finite number >= 0",
          ),
      ],
      [
        "minimumZero",
        () =>
          refuses(
            { minimumPiece: 0 },
            "pattern minimum piece must be a finite number in (0, 1]",
          ),
      ],
      [
        "minimumAbove",
        () =>
          refuses(
            { minimumPiece: 1 + 1e-9 },
            "pattern minimum piece must be a finite number in (0, 1]",
          ),
      ],
      [
        "minimumNonFinite",
        () =>
          refuses(
            { minimumPiece: Number.NaN },
            "pattern minimum piece must be a finite number in (0, 1]",
          ),
      ],
      [
        "grain",
        () =>
          refuses(
            { grainToleranceDeg: -1e-9 },
            "pattern grain tolerance must be a finite number >= 0",
          ),
      ],
      [
        "seedNegative",
        () => refuses({ seed: -1 }, "pattern seed must be a safe integer >= 0"),
      ],
      [
        "seedFractional",
        () =>
          refuses({ seed: 1.5 }, "pattern seed must be a safe integer >= 0"),
      ],
      [
        "variantsZero",
        () =>
          refuses(
            { variants: 0 },
            "pattern variants must be a safe integer >= 1",
          ),
      ],
      [
        "variantsFractional",
        () =>
          refuses(
            { variants: 2.5 },
            "pattern variants must be a safe integer >= 1",
          ),
      ],
      [
        "boundaryValues",
        () =>
          generateAutoMovieSurfacePattern({
            pattern: pattern({
              joint: 0,
              jointTolerance: 0,
              adjacency: 0,
              minimumPiece: 1,
              grainToleranceDeg: 0,
              seed: 0,
              variants: 1,
            }),
          }).placements.length === 8,
      ],
    ]),
    {
      id: true,
      zones: true,
      joint: true,
      tolerance: true,
      adjacency: true,
      minimumZero: true,
      minimumAbove: true,
      minimumNonFinite: true,
      grain: true,
      seedNegative: true,
      seedFractional: true,
      variantsZero: true,
      variantsFractional: true,
      boundaryValues: true,
    },
  );

  TestValidator.equals(
    "zone identity and lattice are refused on their own message",
    namedFacts([
      [
        "blankId",
        () =>
          refuses(
            { zones: [zone({ id: "  " })] },
            "pattern zone[0] id must be non-empty",
          ),
      ],
      [
        "duplicateId",
        () =>
          refuses(
            {
              zones: [
                zone({ region: rectangle(0, 0, 1, 1) }),
                zone({ region: rectangle(1, 0, 2, 1), origin: { u: 1, v: 0 } }),
              ],
            },
            'pattern zone id "field" must be unique',
          ),
      ],
      [
        "origin",
        () =>
          refuses(
            { zones: [zone({ origin: { u: Number.NaN, v: 0 } })] },
            'pattern zone "field" origin must be finite',
          ),
      ],
      [
        "periodU",
        () =>
          refuses(
            { zones: [zone({ period: { u: 0, v: 0.5 } })] },
            'pattern zone "field" period u must be a finite number > 0',
          ),
      ],
      [
        "periodV",
        () =>
          refuses(
            { zones: [zone({ period: { u: 0.5, v: -1 } })] },
            'pattern zone "field" period v must be a finite number > 0',
          ),
      ],
      [
        "reachU",
        () =>
          refuses(
            { zones: [zone({ reach: { u: 0, v: 0.5 } })] },
            'pattern zone "field" reach u must be a finite number > 0',
          ),
      ],
      [
        "reachV",
        () =>
          refuses(
            { zones: [zone({ reach: { u: 0.5, v: Number.NaN } })] },
            'pattern zone "field" reach v must be a finite number > 0',
          ),
      ],
    ]),
    {
      blankId: true,
      duplicateId: true,
      origin: true,
      periodU: true,
      periodV: true,
      reachU: true,
      reachV: true,
    },
  );

  TestValidator.equals(
    "a region must be a finite, area-bearing, convex outline",
    namedFacts([
      [
        "nonFinite",
        () =>
          refuses(
            {
              zones: [
                zone({
                  region: [
                    { u: 0, v: 0 },
                    { u: Number.NaN, v: 0 },
                    { u: 1, v: 1 },
                  ],
                }),
              ],
            },
            "pattern zone[0] region[1] must be finite",
          ),
      ],
      [
        "collinear",
        () =>
          refuses(
            {
              zones: [
                zone({
                  region: [
                    { u: 0, v: 0 },
                    { u: 1, v: 0 },
                    { u: 2, v: 0 },
                  ],
                }),
              ],
            },
            "pattern zone[0] region needs at least three non-collinear points",
          ),
      ],
      [
        "reflex",
        () =>
          refuses(
            {
              zones: [
                zone({
                  region: [
                    { u: 0, v: 0 },
                    { u: 2, v: 0 },
                    { u: 1, v: 0.5 },
                    { u: 2, v: 1 },
                    { u: 0, v: 1 },
                  ],
                }),
              ],
            },
            "pattern zone[0] region must be convex and contain no interior points",
          ),
      ],
    ]),
    { nonFinite: true, collinear: true, reflex: true },
  );

  TestValidator.equals(
    "zones may share an edge but not an area",
    namedFacts([
      [
        "overlapping",
        () =>
          refuses(
            {
              zones: [
                zone({ id: "a", region: rectangle(0, 0, 1.2, 1) }),
                zone({
                  id: "b",
                  region: rectangle(1, 0, 2, 1),
                  origin: { u: 1, v: 0 },
                }),
              ],
            },
            'pattern zones "a" and "b" overlap',
          ),
      ],
      [
        "touching",
        () =>
          generateAutoMovieSurfacePattern({
            pattern: pattern({
              zones: [
                zone({ id: "a", region: rectangle(0, 0, 1, 1) }),
                zone({
                  id: "b",
                  region: rectangle(1, 0, 2, 1),
                  origin: { u: 1, v: 0 },
                }),
              ],
            }),
          }).placements.length === 8,
      ],
    ]),
    { overlapping: true, touching: true },
  );

  TestValidator.equals(
    "exclusions must be identified, convex, and disjoint",
    namedFacts([
      [
        "blankId",
        () =>
          refuses(
            {
              exclusions: [{ id: "", polygon: rectangle(0.1, 0.1, 0.2, 0.2) }],
            },
            "pattern exclusion[0] id must be non-empty",
          ),
      ],
      [
        "duplicateId",
        () =>
          refuses(
            {
              exclusions: [
                { id: "hole", polygon: rectangle(0.1, 0.1, 0.2, 0.2) },
                { id: "hole", polygon: rectangle(0.5, 0.1, 0.6, 0.2) },
              ],
            },
            'pattern exclusion id "hole" must be unique',
          ),
      ],
      [
        "nonConvex",
        () =>
          refuses(
            {
              exclusions: [
                {
                  id: "hole",
                  polygon: [
                    { u: 0, v: 0 },
                    { u: 1, v: 0 },
                    { u: 0.5, v: 0.25 },
                    { u: 1, v: 0.5 },
                    { u: 0, v: 0.5 },
                  ],
                },
              ],
            },
            'pattern exclusion "hole" polygon must be convex and contain no interior points',
          ),
      ],
      [
        "overlapping",
        () =>
          refuses(
            {
              exclusions: [
                { id: "left", polygon: rectangle(0.1, 0.1, 0.4, 0.4) },
                { id: "right", polygon: rectangle(0.3, 0.1, 0.6, 0.4) },
              ],
            },
            'pattern exclusions "left" and "right" overlap',
          ),
      ],
      [
        "touching",
        () =>
          generateAutoMovieSurfacePattern({
            pattern: pattern({
              exclusions: [
                { id: "left", polygon: rectangle(0.1, 0.1, 0.3, 0.4) },
                { id: "right", polygon: rectangle(0.3, 0.1, 0.6, 0.4) },
              ],
            }),
          }).quantities.modules === 8,
      ],
    ]),
    {
      blankId: true,
      duplicateId: true,
      nonConvex: true,
      overlapping: true,
      touching: true,
    },
  );

  TestValidator.equals(
    "a generated module must be identified, finite, sized, and within reach",
    namedFacts([
      [
        "blankId",
        () =>
          refuses(
            {
              zones: [
                zone({
                  generate: ({ origin }) => [
                    {
                      id: " ",
                      center: { u: origin.u + 0.25, v: origin.v + 0.25 },
                      size: { u: 0.5, v: 0.5 },
                      rotationDeg: 0,
                      grainDeg: 0,
                    },
                  ],
                }),
              ],
            },
            'pattern zone "field" module id must be non-empty',
          ),
      ],
      [
        "duplicateId",
        () =>
          refuses(
            {
              zones: [
                zone({
                  generate: ({ origin }) => [
                    {
                      id: "same",
                      center: { u: origin.u + 0.25, v: origin.v + 0.25 },
                      size: { u: 0.5, v: 0.5 },
                      rotationDeg: 0,
                      grainDeg: 0,
                    },
                  ],
                }),
              ],
            },
            'pattern zone "field" module id "same" must be unique',
          ),
      ],
      [
        "centre",
        () =>
          refuses(
            {
              zones: [
                zone({
                  generate: ({ column, row }) => [
                    {
                      id: `t-${column}-${row}`,
                      center: { u: Number.NaN, v: 0 },
                      size: { u: 0.5, v: 0.5 },
                      rotationDeg: 0,
                      grainDeg: 0,
                    },
                  ],
                }),
              ],
            },
            "center must be finite",
          ),
      ],
      [
        "sizeU",
        () =>
          refuses(
            {
              zones: [
                zone({
                  generate: ({ column, row, origin }) => [
                    {
                      id: `t-${column}-${row}`,
                      center: { u: origin.u + 0.25, v: origin.v + 0.25 },
                      size: { u: 0, v: 0.5 },
                      rotationDeg: 0,
                      grainDeg: 0,
                    },
                  ],
                }),
              ],
            },
            "size u must be a finite number > 0",
          ),
      ],
      [
        "sizeV",
        () =>
          refuses(
            {
              zones: [
                zone({
                  generate: ({ column, row, origin }) => [
                    {
                      id: `t-${column}-${row}`,
                      center: { u: origin.u + 0.25, v: origin.v + 0.25 },
                      size: { u: 0.5, v: -0.5 },
                      rotationDeg: 0,
                      grainDeg: 0,
                    },
                  ],
                }),
              ],
            },
            "size v must be a finite number > 0",
          ),
      ],
      [
        "rotation",
        () =>
          refuses(
            {
              zones: [
                zone({
                  generate: ({ column, row, origin }) => [
                    {
                      id: `t-${column}-${row}`,
                      center: { u: origin.u + 0.25, v: origin.v + 0.25 },
                      size: { u: 0.5, v: 0.5 },
                      rotationDeg: Number.NaN,
                      grainDeg: 0,
                    },
                  ],
                }),
              ],
            },
            "rotation and grain must be finite",
          ),
      ],
      [
        "grain",
        () =>
          refuses(
            {
              zones: [
                zone({
                  generate: ({ column, row, origin }) => [
                    {
                      id: `t-${column}-${row}`,
                      center: { u: origin.u + 0.25, v: origin.v + 0.25 },
                      size: { u: 0.5, v: 0.5 },
                      rotationDeg: 0,
                      grainDeg: Number.POSITIVE_INFINITY,
                    },
                  ],
                }),
              ],
            },
            "rotation and grain must be finite",
          ),
      ],
      [
        "reach",
        () =>
          refuses(
            {
              zones: [
                zone({ generate: stackBond(0.5), reach: { u: 0.4, v: 0.5 } }),
              ],
            },
            "reaches beyond the declared reach of its cell origin",
          ),
      ],
    ]),
    {
      blankId: true,
      duplicateId: true,
      centre: true,
      sizeU: true,
      sizeV: true,
      rotation: true,
      grain: true,
      reach: true,
    },
  );

  TestValidator.equals(
    "a lattice above the cell limit is refused before it is walked",
    refuses(
      {
        zones: [
          zone({
            region: rectangle(0, 0, 1000, 1000),
            period: { u: 0.001, v: 0.001 },
            reach: { u: 0.001, v: 0.001 },
          }),
        ],
      },
      ["lattice cells, above the", "cell limit"],
    ),
    true,
  );
};
