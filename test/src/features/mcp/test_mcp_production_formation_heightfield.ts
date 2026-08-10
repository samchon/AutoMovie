import {
  IAutoMovieFormationPlacement,
  worldHeightfield,
} from "@automovie/engine";
import type {
  IAutoMovieFormationDesign,
  IAutoMovieSpace,
  IAutoMovieWorldSurface,
} from "@automovie/interface";
import {
  materializeCompiledFormation,
  validateAutoMovieFormationGround,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** Files in the unit, how far apart they stand, and where it is staged. */
const FILES = 3;
const INTERVAL = 10;
const ANCHOR_HEIGHT = 2;

/** The lattice's own extent, and how high its far corner stands. */
const HALF = 20;
const CORNER = 8;

/**
 * A rise whose relief no level and no single tilt can state.
 *
 * Its lattice is the four corners of one cell, and its far corner alone carries
 * height, so the surface climbs in both axes at once and reads a different
 * number under each of the three members below. The sampler is exactly the
 * bilinear surface the four stored corners describe, so every height a case
 * asserts can be read off `8 (x + 20)(z + 20) / 1600` rather than out of the
 * interpolation under test.
 */
const rise = (): IAutoMovieWorldSurface =>
  worldHeightfield({
    id: "rise",
    polygon: [
      { x: -HALF, z: -HALF },
      { x: HALF, z: -HALF },
      { x: HALF, z: HALF },
      { x: -HALF, z: HALF },
    ],
    origin: { x: -HALF, z: -HALF },
    spacing: { x: 2 * HALF, z: 2 * HALF },
    columns: 2,
    rows: 2,
    height: (point) =>
      (CORNER * (point.x + HALF) * (point.z + HALF)) / (4 * HALF * HALF),
    walkable: true,
  });

/** The same relief, staged far enough away that no member of the unit is on it. */
const elsewhere = (): IAutoMovieWorldSurface => ({
  ...rise(),
  id: "elsewhere",
  polygon: [
    { x: 200, z: 200 },
    { x: 240, z: 200 },
    { x: 240, z: 240 },
    { x: 200, z: 240 },
  ],
});

/** What the rise stands at, from its four stored corners alone. */
const reliefAt = (x: number, z: number): number =>
  (CORNER * (x + HALF) * (z + HALF)) / (4 * HALF * HALF);

/** One rank of three, staged on the rise at the height its anchor stands at. */
const design = (): IAutoMovieFormationDesign => ({
  id: "rank",
  modelRecipe: "member",
  count: FILES,
  layout: {
    kind: "line",
    ranks: 1,
    files: FILES,
    spacing: { lateral: INTERVAL, depth: 1 },
  },
  anchor: { x: 0, y: ANCHOR_HEIGHT, z: 0 },
  facingDeg: 0,
  seed: 1,
  capabilities: [],
  heroOverrides: [],
});

/** The scene space a shot stages, carrying the world's own height rule. */
const stagedSpace = (): IAutoMovieSpace => ({
  id: "field",
  surfaces: [
    {
      id: "rise",
      kind: "floor",
      polygon: rise().polygon.map((point) => ({
        x: point.x,
        y: 0,
        z: point.z,
      })),
      height: rise().height,
    },
  ],
  walkable: ["rise"],
});

/** The unit as the gate reads it: a placement, with or without its terrain. */
const placement = (
  ground?: readonly IAutoMovieWorldSurface[],
): IAutoMovieFormationPlacement => ({
  ...design(),
  ...(ground === undefined ? {} : { ground }),
});

const codes = (ground?: readonly IAutoMovieWorldSurface[]): string[] =>
  validateAutoMovieFormationGround(
    { id: "opening" },
    { scene: { space: stagedSpace() }, formations: [placement(ground)] },
  ).map((diagnostic) => diagnostic.code);

/**
 * A sampled relief reaches the compiler: the runtime a shot carries is placed
 * on it, and the gate that refuses a unit standing off its ground reads it.
 *
 * `constant` and `plane` are a level and a tilt, so a hill, a terrace or a bank
 * can only be stated as a lattice — and until this, no lattice ever reached the
 * compiler at all. It appeared in the engine's own tests and in one hand-built
 * validation record, so every claim about relief was a claim about the height
 * function rather than about a production standing on one.
 *
 * The unit here is one rank of three at ten-metre intervals, staged two metres
 * up on a rise that climbs in both axes. The rise reads 1, 2 and 3 m under its
 * three members, so the members stand at 1, 2 and 3 — relief measured against
 * the anchor's own ground, which is what keeps `anchor.y` meaning the height
 * the unit was staged at.
 *
 * Scenarios:
 *
 * 1. Compiling the unit on the rise snapshots exactly the surfaces that reach its
 *    own footprint, and no others: terrain the unit never stands on is not
 *    carried with it.
 * 2. The compiled bounds span the relief rather than the anchor's single height,
 *    and each member's own height is the rise's under that member. Compiling
 *    the same unit over no terrain at all gives the flat answer it gave before
 *    relief existed, which is the compatibility half of the same claim.
 * 3. The shot's own gate reads the same lattice: the grounded unit stands on the
 *    space the shot staged and is accepted.
 * 4. The same unit compiled flat is refused by that gate, because its far file
 *    stands a metre under a rise that is three metres high there. That is the
 *    pair the whole lattice path rests on — if the gate read the rule as a
 *    level, both would pass.
 */
export const test_mcp_production_formation_heightfield = (): void => {
  const grounded = materializeCompiledFormation(
    design(),
    new Map(),
    new Map(),
    [rise(), elsewhere()],
  );
  const flat = materializeCompiledFormation(design(), new Map(), new Map(), []);

  TestValidator.equals(
    "a compiled unit carries exactly the terrain that reaches its own footprint",
    namedFacts([
      ["one", () => grounded.ground.length === 1],
      ["theRise", () => grounded.ground[0]!.id === "rise"],
      ["aLattice", () => grounded.ground[0]!.height.kind === "heightfield"],
      ["noneAtAll", () => flat.ground.length === 0],
    ]),
    { one: true, theRise: true, aLattice: true, noneAtAll: true },
  );

  TestValidator.equals(
    "the compiled bounds span the relief the lattice states",
    namedFacts([
      // Files at -10, 0 and 10 on z = 0, where the rise reads 1, 2 and 3.
      [
        "relief",
        () =>
          nclose(reliefAt(-INTERVAL, 0), 1, 1e-12) &&
          nclose(reliefAt(0, 0), ANCHOR_HEIGHT, 1e-12) &&
          nclose(reliefAt(INTERVAL, 0), 3, 1e-12),
      ],
      ["lowest", () => nclose(grounded.bounds.min.y, 1, 1e-9)],
      ["highest", () => nclose(grounded.bounds.max.y, 3, 1e-9)],
      // The anchor's own ground is the datum, so the middle file keeps exactly
      // the height the unit was staged at.
      ["centroid", () => nclose(grounded.centroid.y, ANCHOR_HEIGHT, 1e-9)],
      // And with no terrain the same design compiles to the one height it
      // compiled to before a lattice could be stated.
      [
        "flatIsOneHeight",
        () =>
          nclose(flat.bounds.min.y, ANCHOR_HEIGHT, 1e-12) &&
          nclose(flat.bounds.max.y, ANCHOR_HEIGHT, 1e-12),
      ],
    ]),
    {
      relief: true,
      lowest: true,
      highest: true,
      centroid: true,
      flatIsOneHeight: true,
    },
  );

  TestValidator.equals(
    "a unit placed on the lattice stands on the space its shot staged",
    codes(grounded.ground),
    [],
  );

  const sunk = validateAutoMovieFormationGround(
    { id: "opening" },
    { scene: { space: stagedSpace() }, formations: [placement()] },
  );
  TestValidator.equals(
    "the same unit placed flat is standing inside the rise, and is refused",
    namedFacts([
      ["one", () => sunk.length === 1],
      ["code", () => sunk[0]!.code === "engine-validation-failed"],
      ["unit", () => sunk[0]!.message.startsWith("formation:rank ")],
      // The far file, where the lattice reads three metres and the flat unit
      // stands at two.
      ["place", () => sunk[0]!.message.includes(`(${INTERVAL}, 0)`)],
      ["carried", () => sunk[0]!.message.includes("below the 3m")],
    ]),
    { one: true, code: true, unit: true, place: true, carried: true },
  );
};
