import {
  worldGroundHeight,
  worldGroundSurface,
  worldHeightfield,
  worldRamp,
  worldSurfaceHeight,
  worldTerrain,
} from "@automovie/engine";
import { IAutoMovieWorldSurface } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

/** A square footprint of a stated half-extent, centred on the origin. */
const square = (half: number): IAutoMovieWorldSurface["polygon"] => [
  { x: -half, z: -half },
  { x: half, z: -half },
  { x: half, z: half },
  { x: -half, z: half },
];

/**
 * A four-metre hill sampled on a three-by-three lattice over `[-4, 4]`.
 *
 * The sampler is a rule rather than a transcription, so the lattice reads the
 * same hill the prose describes: height climbs with `z` and dips with `|x|`,
 * which makes every one of the nine samples a different number and leaves no
 * two facts below able to pass by accident.
 */
const hill = (): IAutoMovieWorldSurface =>
  worldHeightfield({
    id: "hill",
    polygon: square(4),
    origin: { x: -4, z: -4 },
    spacing: { x: 4, z: 4 },
    columns: 3,
    rows: 3,
    height: (point) => point.z * 0.5 - Math.abs(point.x) * 0.25,
    walkable: true,
  });

/** The rule of {@link hill}, as the oracle every sampled fact is read against. */
const hillHeight = (point: { x: number; z: number }): number =>
  point.z * 0.5 - Math.abs(point.x) * 0.25;

/**
 * Terrain can rise, and a rise is sampled rather than assumed.
 *
 * `constant` states one number and `plane` states one tilt, so between them
 * they can describe a floor and a ramp and nothing else. A hill, a terraced
 * square, a bank falling to a river: every one of those is a surface whose
 * height is not an affine function of its position, and until a rule could
 * express one, no production could stage anything on real ground. A lattice of
 * stored samples interpolated between is the ordinary answer and the smallest
 * one that works, so that is the rule.
 *
 * What makes it usable is that it stays exact where it was authored and bounded
 * where it was not: a lattice point reads its own number back, the space
 * between two reads their blend, and a query past the edge reads the edge
 * rather than an extrapolation that would invent terrain. Nothing here consults
 * a clock, a file, or a seed, so the same design answers the same heights on
 * every machine, which is the whole reason relief is stored as numbers instead
 * of as the function that made them.
 *
 * Scenarios:
 *
 * 1. Every lattice point reads back exactly the height its sampler authored, so a
 *    member standing on a sample stands where the author put it.
 * 2. A cell midpoint is the mean of that cell's four corners, which is what
 *    bilinear interpolation means and is checked against the corners rather
 *    than against the sampler, since between samples the lattice is the
 *    authority and the function that filled it is not.
 * 3. A query outside the lattice reads its nearest edge sample rather than an
 *    extrapolation, because a sampled relief says nothing about ground it never
 *    covered. The polygon, not the lattice, still bounds where the surface is.
 * 4. Reading the same field twice answers identically, and a second field built
 *    from the same sampler answers identically to the first: relief is stored
 *    numbers, so nothing about the machine can reach it.
 * 5. `constant` and `plane` answer exactly what they answered before, so adding a
 *    third rule changed neither of the two that existed.
 * 6. The ground under a point is the first declared surface containing it, so a
 *    terraced square states its steps in the order it wants them read, and a
 *    point on a footprint edge is on that surface rather than off it.
 * 7. A point over no surface at all has no ground, which is a different answer
 *    from ground at zero and has to stay one: a formation over nothing keeps
 *    the height it was staged at instead of being dropped to the world origin.
 * 8. The builder refuses what it cannot sample deterministically: a degenerate
 *    pitch, a lattice too small to interpolate across, a blank id, and a
 *    sampler that answers with a non-finite height.
 * 9. A malformed field whose samples do not fill its lattice reads zero rather
 *    than `NaN`, so a record design validation refuses is wrong in a way a
 *    reader can see instead of poisoning every number downstream of it.
 */
export const test_world_heightfield_terrain = (): void => {
  const field = hill();
  const lattice = [-4, 0, 4];
  TestValidator.predicate(
    "every lattice point reads back its own authored height",
    lattice.every((z) =>
      lattice.every((x) =>
        nclose(
          worldSurfaceHeight(field, { x, z }),
          hillHeight({ x, z }),
          1e-12,
        ),
      ),
    ),
  );

  // The cell from (0, 0) to (4, 4). Its four corners are 0, -1, 2 and 1, so the
  // centre is 0.5 — which the sampler itself would call 1 - 0.5 = 0.5 here only
  // by coincidence of this cell being planar. The corner at (-4, 0) is what
  // makes the field genuinely non-affine and is why `plane` cannot hold it.
  const corners = [
    hillHeight({ x: 0, z: 0 }),
    hillHeight({ x: 4, z: 0 }),
    hillHeight({ x: 0, z: 4 }),
    hillHeight({ x: 4, z: 4 }),
  ];
  TestValidator.equals(
    "between samples the lattice blends its own corners",
    namedFacts([
      [
        "centre",
        () =>
          nclose(
            worldSurfaceHeight(field, { x: 2, z: 2 }),
            corners.reduce((sum, value) => sum + value, 0) / 4,
            1e-12,
          ),
      ],
      // Affine over any one cell, and not over the field: this is the fact that
      // no `plane` rule can hold this surface. The line at `z` of 0 runs -1, 0,
      // -1 across its three samples, so a plane through its ends is level at -1
      // and would read -1 here; the field reads -0.5. Restating the three
      // lattice points that make that so would restate the case above, which
      // already reads every one of them back.
      [
        "edge",
        () =>
          nclose(
            worldSurfaceHeight(field, { x: 2, z: 0 }),
            (corners[0]! + corners[1]!) / 2,
            1e-12,
          ),
      ],
    ]),
    { centre: true, edge: true },
  );

  TestValidator.equals(
    "a query outside the lattice reads its edge rather than an extrapolation",
    namedFacts([
      [
        "beyondPositiveX",
        () =>
          nclose(
            worldSurfaceHeight(field, { x: 40, z: 0 }),
            hillHeight({ x: 4, z: 0 }),
            1e-12,
          ),
      ],
      [
        "beyondNegativeZ",
        () =>
          nclose(
            worldSurfaceHeight(field, { x: 0, z: -40 }),
            hillHeight({ x: 0, z: -4 }),
            1e-12,
          ),
      ],
      [
        "beyondBoth",
        () =>
          nclose(
            worldSurfaceHeight(field, { x: -40, z: 40 }),
            hillHeight({ x: -4, z: 4 }),
            1e-12,
          ),
      ],
    ]),
    { beyondPositiveX: true, beyondNegativeZ: true, beyondBoth: true },
  );

  // What "relief is stored numbers" comes down to, written as the numbers. The
  // nine heights {@link hill}'s rule leaves behind, in the row-major order the
  // builder documents — rows along `+z` from the origin, columns along `+x`
  // inside each — as a literal rather than as a second call to the rule, which
  // would only say that a pure function is pure. The field dips in `x` while it
  // climbs in `z`, so a lattice stored transposed, reversed, or from another
  // corner really is a different array here.
  TestValidator.equals(
    "the sampler leaves nine stored heights, row-major from the origin",
    field.height.kind === "heightfield" ? field.height.samples : null,
    [-3, -2, -3, -1, 0, -1, 1, 2, 1],
  );

  const flat = worldTerrain({
    id: "flat",
    polygon: square(4),
    height: 2.5,
    walkable: true,
  });
  const ramp = worldRamp({
    id: "ramp",
    from: { x: 0, z: 0 },
    to: { x: 0, z: 10 },
    width: 4,
    baseHeight: 1,
    rise: 5,
    walkable: true,
  });
  TestValidator.equals(
    "the two rules that existed answer exactly what they answered before",
    namedFacts([
      ["flatHere", () => worldSurfaceHeight(flat, { x: 3, z: -3 }) === 2.5],
      ["flatThere", () => worldSurfaceHeight(flat, { x: -1, z: 4 }) === 2.5],
      [
        "rampBase",
        () => nclose(worldSurfaceHeight(ramp, { x: 0, z: 0 }), 1, 1e-12),
      ],
      [
        "rampTop",
        () => nclose(worldSurfaceHeight(ramp, { x: 0, z: 10 }), 6, 1e-12),
      ],
      [
        "rampMiddle",
        () => nclose(worldSurfaceHeight(ramp, { x: 2, z: 5 }), 3.5, 1e-12),
      ],
    ]),
    {
      flatHere: true,
      flatThere: true,
      rampBase: true,
      rampTop: true,
      rampMiddle: true,
    },
  );

  // A step standing on a wider terrace: both contain the origin, and the one
  // declared first is the one a member stands on.
  const terrace = worldTerrain({
    id: "terrace",
    polygon: square(8),
    height: 0,
    walkable: true,
  });
  const step = worldTerrain({
    id: "step",
    polygon: square(2),
    height: 1.5,
    walkable: true,
  });
  TestValidator.equals(
    "the ground under a point is the first declared surface containing it",
    namedFacts([
      [
        "stepFirst",
        () =>
          worldGroundSurface([step, terrace], { x: 0, z: 0 })?.id === "step",
      ],
      [
        "terraceFirst",
        () =>
          worldGroundSurface([terrace, step], { x: 0, z: 0 })?.id === "terrace",
      ],
      [
        "height",
        () => worldGroundHeight([step, terrace], { x: 0, z: 0 }) === 1.5,
      ],
      // The edge of a floor is still floor. A unit sized to its own ground puts
      // its outermost rank exactly here, and a strict reading would drop it off
      // the terrain the author sized for it.
      [
        "onTheEdge",
        () => worldGroundSurface([step], { x: 2, z: 0 })?.id === "step",
      ],
      [
        "onACorner",
        () => worldGroundSurface([step], { x: -2, z: 2 })?.id === "step",
      ],
    ]),
    {
      stepFirst: true,
      terraceFirst: true,
      height: true,
      onTheEdge: true,
      onACorner: true,
    },
  );

  TestValidator.equals(
    "a point over no surface has no ground, which is not ground at zero",
    namedFacts([
      ["noSurface", () => worldGroundSurface([step], { x: 40, z: 0 }) === null],
      ["noHeight", () => worldGroundHeight([step], { x: 40, z: 0 }) === null],
      ["noneAtAll", () => worldGroundHeight([], { x: 0, z: 0 }) === null],
    ]),
    { noSurface: true, noHeight: true, noneAtAll: true },
  );

  const builder = (
    overrides: Partial<Parameters<typeof worldHeightfield>[0]>,
  ): (() => IAutoMovieWorldSurface) => {
    const input = {
      id: "probe",
      polygon: square(4),
      origin: { x: -4, z: -4 },
      spacing: { x: 4, z: 4 },
      columns: 3,
      rows: 3,
      height: () => 0,
      walkable: true,
      ...overrides,
    };
    return () => worldHeightfield(input);
  };
  TestValidator.equals(
    "the builder refuses a lattice it could not sample deterministically",
    namedFacts([
      ["blankId", () => throwsError(builder({ id: "  " }), "non-whitespace")],
      [
        "zeroPitch",
        () => throwsError(builder({ spacing: { x: 0, z: 1 } }), "positive"),
      ],
      [
        "infiniteOrigin",
        () =>
          throwsError(
            builder({ origin: { x: Number.POSITIVE_INFINITY, z: 0 } }),
            "finite origin",
          ),
      ],
      [
        "oneColumn",
        () => throwsError(builder({ columns: 1 }), "at least two sample"),
      ],
      [
        "fractionalRows",
        () => throwsError(builder({ rows: 2.5 }), "at least two sample"),
      ],
      [
        "unsampleable",
        () => throwsError(builder({ height: () => NaN }), "non-finite height"),
      ],
    ]),
    {
      blankId: true,
      zeroPitch: true,
      infiniteOrigin: true,
      oneColumn: true,
      fractionalRows: true,
      unsampleable: true,
    },
  );

  const malformed: IAutoMovieWorldSurface = {
    id: "malformed",
    polygon: square(1),
    height: {
      kind: "heightfield",
      originX: 0,
      originZ: 0,
      spacingX: 1,
      spacingZ: 1,
      columns: 2,
      rows: 2,
      samples: [3],
    },
    walkable: true,
  };
  TestValidator.equals(
    "a field whose samples do not fill its lattice reads zero rather than NaN",
    namedFacts([
      ["stored", () => worldSurfaceHeight(malformed, { x: 0, z: 0 }) === 3],
      ["missing", () => worldSurfaceHeight(malformed, { x: 1, z: 1 }) === 0],
      [
        "blended",
        () =>
          nclose(worldSurfaceHeight(malformed, { x: 0.5, z: 0 }), 1.5, 1e-12),
      ],
    ]),
    { stored: true, missing: true, blended: true },
  );
};
