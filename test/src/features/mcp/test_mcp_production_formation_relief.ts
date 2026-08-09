import {
  IAutoMovieFormationPlacement,
  worldRamp,
  worldTerrain,
} from "@automovie/engine";
import {
  IAutoMovieFormationDesign,
  IAutoMovieSpace,
  IAutoMovieWorldSurface,
} from "@automovie/interface";
import {
  materializeCompiledFormation,
  validateAutoMovieFormationGround,
} from "@automovie/mcp";
import { regenerateFormationSlot } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const FILES = 3;
const RANKS = 4;
const COUNT = FILES * RANKS;

/** Ranks at `z` of 0, 3, 6 and 9; files at `x` of -2, 0 and 2. */
const layout: IAutoMovieFormationDesign["layout"] = {
  kind: "line",
  ranks: RANKS,
  files: FILES,
  spacing: { lateral: 2, depth: 3 },
};

/** One unit of twelve staged at a given height, with a promoted hero. */
const unit = (height = 0): IAutoMovieFormationDesign => ({
  id: "block",
  modelRecipe: "member",
  count: COUNT,
  layout,
  anchor: { x: 0, y: height, z: 0 },
  facingDeg: 0,
  seed: 3,
  capabilities: [],
  heroOverrides: [{ slot: COUNT - 1, actor: "banner" }],
});

/** The same unit as the gate sees it: placement plus the terrain under it. */
const staged = (props: {
  height?: number;
  ground?: readonly IAutoMovieWorldSurface[];
}): IAutoMovieFormationPlacement => ({
  id: "block",
  count: COUNT,
  layout,
  anchor: { x: 0, y: props.height ?? 0, z: 0 },
  facingDeg: 0,
  seed: 3,
  ...(props.ground === undefined ? {} : { ground: props.ground }),
});

/** Terrain climbing half a metre for every metre of `z`, level in `x`. */
const bank = (): IAutoMovieWorldSurface =>
  worldRamp({
    id: "bank",
    from: { x: 0, z: 0 },
    to: { x: 0, z: 20 },
    width: 60,
    baseHeight: 0,
    rise: 10,
    walkable: true,
  });

/** Terrain far from the unit, which no member of it can ever stand on. */
const elsewhere = (): IAutoMovieWorldSurface =>
  worldTerrain({
    id: "elsewhere",
    polygon: [
      { x: 200, z: 200 },
      { x: 240, z: 200 },
      { x: 240, z: 240 },
      { x: 200, z: 240 },
    ],
    height: 12,
    walkable: true,
  });

/** A square staged floor at a stated level. */
const flatSpace = (height: number): IAutoMovieSpace => ({
  id: "flat",
  surfaces: [
    {
      id: "ground",
      kind: "floor",
      polygon: [
        { x: -20, y: 0, z: -20 },
        { x: 20, y: 0, z: -20 },
        { x: 20, y: 0, z: 20 },
        { x: -20, y: 0, z: 20 },
      ],
      anchor: { x: 0, y: height, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["ground"],
});

/** A staged slope rising half a metre per metre of `z`, matching {@link bank}. */
const slopedSpace = (): IAutoMovieSpace => ({
  id: "sloped",
  surfaces: [
    {
      id: "ground",
      kind: "ramp",
      polygon: [
        { x: -20, y: 0, z: -20 },
        { x: 20, y: 0, z: -20 },
        { x: 20, y: 0, z: 20 },
        { x: -20, y: 0, z: 20 },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: { x: 0, y: 10, z: 20 },
    },
  ],
  walkable: ["ground"],
});

const refusals = (
  space: IAutoMovieSpace,
  formation: IAutoMovieFormationPlacement,
): string[] =>
  validateAutoMovieFormationGround(
    { id: "opening" },
    { scene: { space }, formations: [formation] },
  ).map((diagnostic) => diagnostic.message);

/**
 * A compiled unit carries the ground it stands on, and the gate reads its
 * height.
 *
 * Placement height is only worth anything if it survives compilation and if
 * every consumer reads the same one. The compiled formation is compact by
 * design — it never stores a member — so the terrain has to travel with it the
 * way a compiled instance set already carries the route it follows, and only
 * the terrain that reaches the unit's own footprint, since a compiled record is
 * shipped and read on every frame.
 *
 * The gate then owes the same duty in height that it already owed in plan. A
 * member standing a metre under the terrain is as invisible as one standing off
 * the edge of it, and until now a shot could stage a whole unit inside a hill
 * and compile clean. Standing above is left alone deliberately: `anchor.y` has
 * always been the height a unit was staged at, and holding a rank over the
 * space a shot modelled is a composition rather than a mistake.
 *
 * Scenarios:
 *
 * 1. The compiled record keeps the terrain reaching its footprint, in the order it
 *    was declared, and drops terrain that reaches none of it: a shipped record
 *    carries what its members stand on and not the whole world.
 * 2. On a bank the compiled bounds and centroid carry the relief, so every
 *    consumer reading a unit's extent — culling, framing, subject extent —
 *    reads a unit that has height rather than a flat slab.
 * 3. The viewer regenerates exactly the placement the compiler materialized, slot
 *    for slot. Two answers to where a member stands is how a gate and a
 *    renderer come to disagree, and the drawn one would be the second.
 * 4. A promoted hero's compiler-owned transform carries the relief too, so the
 *    named member of a unit stands with the anonymous ones rather than at the
 *    group's height.
 * 5. A unit compiled with no terrain declared is exactly the unit that compiled
 *    before: empty ground, every member at the anchor's height.
 * 6. Terrain is part of what a compiled unit is: the same design over the same
 *    ground digests identically, and over different ground it does not.
 * 7. A unit staged under the floor its shot staged is refused, naming where it
 *    stands and what stands over it — the same duty the gate already had for a
 *    unit standing over nothing.
 * 8. A unit staged exactly on that floor is accepted, and one staged above it is
 *    accepted too, because an authored clearance is a composition and the gate
 *    refuses only what nothing can see.
 * 9. The headline: a unit on a staged slope is refused without terrain under it
 *    and accepted with it. Relief is what makes a crowd on real ground
 *    compilable at all, and the gate is what proves the relief arrived.
 */
export const test_mcp_production_formation_relief = (): void => {
  const terrain = [bank(), elsewhere()];
  const compiled = materializeCompiledFormation(
    unit(),
    new Map(),
    undefined,
    terrain,
  );
  TestValidator.equals(
    "a compiled unit carries the terrain reaching it and no more",
    compiled.ground.map((surface) => surface.id),
    ["bank"],
  );
  TestValidator.predicate(
    "the carried terrain is the compiled record's own, not the design's",
    compiled.ground[0] !== terrain[0],
  );

  TestValidator.equals(
    "the compiled extent carries the relief instead of a flat slab",
    namedFacts([
      // Ranks at z of 0 and 9 on half a metre per metre: 0 through 4.5.
      ["low", () => nclose(compiled.bounds.min.y, 0, 1e-9)],
      ["high", () => nclose(compiled.bounds.max.y, 4.5, 1e-9)],
      // Four ranks of three, evenly weighted: the mean of 0, 1.5, 3 and 4.5.
      ["centroid", () => nclose(compiled.centroid.y, 2.25, 1e-9)],
      [
        "chunkAgrees",
        () =>
          compiled.chunks.length === 1 &&
          nclose(compiled.chunks[0]!.bounds.max.y, 4.5, 1e-9),
      ],
    ]),
    { low: true, high: true, centroid: true, chunkAgrees: true },
  );

  TestValidator.predicate(
    "the viewer regenerates exactly the placement the compiler materialized",
    Array.from({ length: COUNT }, (_unused, slot) => slot).every((slot) => {
      const drawn = regenerateFormationSlot(compiled, slot).position;
      const rank = Math.floor(slot / FILES);
      return (
        nclose(drawn.y, rank * 3 * 0.5, 1e-9) &&
        nclose(drawn.z, rank * 3, 1e-12)
      );
    }),
  );

  TestValidator.predicate(
    "a promoted hero's compiled transform carries the relief too",
    nclose(compiled.heroes[0]!.transform.translation.y, 4.5, 1e-9),
  );

  const bare = materializeCompiledFormation(unit());
  TestValidator.equals(
    "a unit with no terrain declared compiles exactly as it did before",
    namedFacts([
      ["empty", () => bare.ground.length === 0],
      ["flatLow", () => bare.bounds.min.y === 0],
      ["flatHigh", () => bare.bounds.max.y === 0],
      [
        "everyMember",
        () =>
          Array.from({ length: COUNT }, (_unused, slot) => slot).every(
            (slot) => regenerateFormationSlot(bare, slot).position.y === 0,
          ),
      ],
    ]),
    { empty: true, flatLow: true, flatHigh: true, everyMember: true },
  );

  TestValidator.equals(
    "terrain is part of what a compiled unit is",
    namedFacts([
      [
        "reproduces",
        () =>
          materializeCompiledFormation(unit(), new Map(), undefined, terrain)
            .digest === compiled.digest,
      ],
      ["differs", () => bare.digest !== compiled.digest],
    ]),
    { reproduces: true, differs: true },
  );

  const sunk = refusals(flatSpace(2), staged({}));
  TestValidator.equals(
    "a unit staged under the floor its shot staged is refused, and told why",
    namedFacts([
      ["one", () => sunk.length === 1],
      ["names", () => sunk[0]!.startsWith("formation:block ")],
      ["place", () => sunk[0]!.includes("at 0m, below the 2m")],
      ["surface", () => sunk[0]!.includes("the surface there stands at")],
    ]),
    { one: true, names: true, place: true, surface: true },
  );

  TestValidator.equals(
    "standing on the staged floor and standing over it are both accepted",
    namedFacts([
      ["on", () => refusals(flatSpace(2), staged({ height: 2 })).length === 0],
      [
        "above",
        () => refusals(flatSpace(2), staged({ height: 5 })).length === 0,
      ],
      // Under it by less than the stated tolerance is still standing on it: a
      // gate refusing the last bits of two interpolations would refuse a unit
      // that was correct.
      [
        "withinTolerance",
        () => refusals(flatSpace(2), staged({ height: 2 - 5e-4 })).length === 0,
      ],
    ]),
    { on: true, above: true, withinTolerance: true },
  );

  TestValidator.equals(
    "a unit on a staged slope compiles only once its terrain relieves it",
    namedFacts([
      ["flatIsRefused", () => refusals(slopedSpace(), staged({})).length === 1],
      [
        "buriedRank",
        () => refusals(slopedSpace(), staged({}))[0]!.includes("below the"),
      ],
      [
        "relievedIsAccepted",
        () =>
          refusals(slopedSpace(), staged({ ground: [bank()] })).length === 0,
      ],
    ]),
    { flatIsRefused: true, buriedRank: true, relievedIsAccepted: true },
  );
};
