import {
  AUTOMOVIE_FORMATION_CHUNK_SIZE,
  materializeCompiledFormation,
  productionRuntimeModelId,
  worldRamp,
} from "@automovie/engine";
import {
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieWorldSurface,
} from "@automovie/interface";
import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import {
  namedFacts,
  nclose,
  qclose,
  throwsError,
  vclose,
} from "../internal/predicates";

/**
 * One chunk plus one member, in a single rank one metre apart along x.
 *
 * File `slot` stands at `x = slot - 512`, so the rank spans -512 to 512 and the
 * first chunk ends one metre short of the last member.
 */
const column = (
  overrides: Partial<IAutoMovieFormationDesign> = {},
): IAutoMovieFormationDesign => ({
  id: "column",
  modelRecipe: "member",
  count: AUTOMOVIE_FORMATION_CHUNK_SIZE + 1,
  layout: {
    kind: "line",
    files: AUTOMOVIE_FORMATION_CHUNK_SIZE + 1,
    ranks: 1,
    spacing: { lateral: 1, depth: 1 },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 11,
  capabilities: [],
  // Out of slot order on purpose: the compiled heroes are ordered by slot.
  heroOverrides: [
    { slot: AUTOMOVIE_FORMATION_CHUNK_SIZE, actor: "rear" },
    { slot: 0, actor: "front" },
  ],
  ...overrides,
});

const recipe = (
  id: string,
  lod: IAutoMovieModelRecipe["lod"],
  parameters: IAutoMovieModelRecipe["parameters"] = { height: 1.8 },
): IAutoMovieModelRecipe => ({
  id,
  role: "performer",
  archetype: "stickman",
  parameters,
  palette: { body: "#808080" },
  lod,
  capabilities: [],
  attachments: [],
});

/** A declared hero tier, a near tier of the base recipe, and a far tier nobody declared. */
const tiered = (): Map<string, IAutoMovieModelRecipe> =>
  new Map([
    [
      "member",
      recipe("member", [
        { tier: "hero", maxDistance: 2, recipe: "member-hero" },
        { tier: "near", maxDistance: 20, recipe: "member" },
        { tier: "far", maxDistance: null, recipe: "member-far" },
      ]),
    ],
    ["member-hero", recipe("member-hero", [])],
  ]);

/** The Node builder's digest of one value's canonical JSON. */
const nodeDigest = (value: unknown): string =>
  digestAutoMovieBytes(canonicalAutoMovieJsonBytes(value));

/** A flat rectangle from one ground-plan point to another, `width` across. */
const strip = (
  id: string,
  from: { x: number; z: number },
  to: { x: number; z: number },
  width: number,
): IAutoMovieWorldSurface =>
  worldRamp({ id, from, to, width, baseHeight: 0, rise: 0, walkable: true });

/**
 * A formation compiles to a compact record that stores what regenerates its
 * members, and to the same record wherever it compiles.
 *
 * Every expectation is hand geometry on one rank of 1,025 members a metre apart,
 * or the Node builder's own digest of canonical JSON: the engine kernel runs no
 * Node built-in, so a digest equal to Node's is the evidence that moving the
 * kernel out of the Node package kept every compiled identity.
 *
 * Scenarios:
 *
 * 1. One member past a chunk makes two chunks: the first 1,024 members and the
 *    last one, each with its exact bounds and centroid, and each counting its
 *    anonymous members after the hero standing in it is excluded.
 * 2. Heroes compile in slot order at their slot's position, turned by the
 *    heading; a quarter heading turns them a quarter about +Y.
 * 3. Anonymous tiers drop the declared hero tier and keep the rest in order;
 *    each carries the Node digest of its recipe, a marker digest naming a recipe
 *    that is absent or cannot be encoded, and its runtime model id. A base
 *    recipe declaring no tiers draws through one near tier of itself.
 * 4. The member radius is the largest tier radius, a tier without one borrowing
 *    the base recipe's, then half a metre, and never below a centimetre.
 * 5. Only terrain reaching the rank's own footprint is snapshotted, in declared
 *    order; a surface beyond it on each of the four sides is dropped.
 * 6. The record's digest is the Node digest of every other field, identical for
 *    identical input and different for another seed, with and without terrain.
 * 7. Omitted recipes, radii and terrain compile a record with no terrain, one
 *    near tier and a half-metre radius, and a hero outside the formation refuses
 *    compilation.
 */
export const test_engine_compiled_formation_runtime = (): void => {
  // 1. Chunks.
  const compiled = materializeCompiledFormation({ formation: column() });
  const [first, last] = compiled.chunks;
  TestValidator.equals(
    "one member past a chunk compiles to two exact chunks",
    namedFacts([
      ["two", () => compiled.chunks.length === 2],
      [
        "firstRange",
        () =>
          first!.index === 0 && first!.start === 0 && first!.count === 1_024,
      ],
      ["firstAnonymous", () => first!.anonymousCount === 1_023],
      [
        "firstBounds",
        () =>
          vclose(first!.bounds.min, { x: -512, y: 0, z: 0 }, 0) &&
          vclose(first!.bounds.max, { x: 511, y: 0, z: 0 }, 0),
      ],
      [
        "firstCentroid",
        () => vclose(first!.centroid, { x: -0.5, y: 0, z: 0 }, 1e-9),
      ],
      [
        "lastRange",
        () => last!.index === 1 && last!.start === 1_024 && last!.count === 1,
      ],
      ["lastAnonymous", () => last!.anonymousCount === 0],
      ["lastCentroid", () => vclose(last!.centroid, { x: 512, y: 0, z: 0 }, 0)],
      [
        "total",
        () => compiled.count === 1_025 && compiled.anonymousCount === 1_023,
      ],
      [
        "totalBounds",
        () =>
          nclose(compiled.bounds.min.x, -512, 0) &&
          nclose(compiled.bounds.max.x, 512, 0),
      ],
      [
        "totalCentroid",
        () => vclose(compiled.centroid, { x: 0, y: 0, z: 0 }, 1e-9),
      ],
    ]),
    {
      two: true,
      firstRange: true,
      firstAnonymous: true,
      firstBounds: true,
      firstCentroid: true,
      lastRange: true,
      lastAnonymous: true,
      lastCentroid: true,
      total: true,
      totalBounds: true,
      totalCentroid: true,
    },
  );

  // 2. Heroes.
  const turned = materializeCompiledFormation({
    formation: column({ facingDeg: 90 }),
  });
  TestValidator.equals(
    "heroes compile in slot order at their slot, turned by the heading",
    namedFacts([
      [
        "order",
        () =>
          compiled.heroes.map((hero) => hero.actor).join(",") === "front,rear",
      ],
      [
        "front",
        () =>
          vclose(
            compiled.heroes[0]!.transform.translation,
            { x: -512, y: 0, z: 0 },
            0,
          ),
      ],
      [
        "rear",
        () =>
          vclose(
            compiled.heroes[1]!.transform.translation,
            { x: 512, y: 0, z: 0 },
            0,
          ),
      ],
      [
        "unturned",
        () =>
          qclose(
            compiled.heroes[0]!.transform.rotation,
            { x: 0, y: 0, z: 0, w: 1 },
            1e-12,
          ),
      ],
      [
        "unitScale",
        () =>
          vclose(compiled.heroes[0]!.transform.scale, { x: 1, y: 1, z: 1 }, 0),
      ],
      [
        "quarter",
        () =>
          qclose(
            turned.heroes[0]!.transform.rotation,
            { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
            1e-12,
          ),
      ],
    ]),
    {
      order: true,
      front: true,
      rear: true,
      unturned: true,
      unitScale: true,
      quarter: true,
    },
  );

  // 3. Tiers.
  const recipes = tiered();
  const withTiers = materializeCompiledFormation({
    formation: column(),
    recipes,
  });
  const unencodable = materializeCompiledFormation({
    formation: column(),
    recipes: new Map([
      ["member", recipe("member", [], { height: Number.NaN })],
    ]),
  });
  TestValidator.equals(
    "anonymous tiers drop the hero tier and bind each recipe digest",
    namedFacts([
      [
        "tiers",
        () => withTiers.lod.map((item) => item.tier).join(",") === "near,far",
      ],
      [
        "nearDigest",
        () =>
          withTiers.lod[0]!.recipeDigest === nodeDigest(recipes.get("member")),
      ],
      [
        "farMissing",
        () =>
          withTiers.lod[1]!.recipeDigest ===
          nodeDigest({ id: "member-far", missing: true }),
      ],
      [
        "models",
        () =>
          withTiers.lod.every(
            (item) => item.model === productionRuntimeModelId(item.recipe),
          ),
      ],
      [
        "defaultTier",
        () =>
          compiled.lod.length === 1 &&
          compiled.lod[0]!.tier === "near" &&
          compiled.lod[0]!.maxDistance === null &&
          compiled.lod[0]!.recipe === "member" &&
          compiled.lod[0]!.recipeDigest ===
            nodeDigest({ id: "member", missing: true }),
      ],
      [
        "unencodable",
        () =>
          unencodable.lod[0]!.recipeDigest ===
          nodeDigest({ id: "member", unencodable: true }),
      ],
    ]),
    {
      tiers: true,
      nearDigest: true,
      farMissing: true,
      models: true,
      defaultTier: true,
      unencodable: true,
    },
  );

  // 4. Radius.
  const radius = (
    radii: ReadonlyArray<readonly [string, number]>,
    tierRecipes: ReadonlyMap<string, IAutoMovieModelRecipe> = recipes,
  ): number =>
    materializeCompiledFormation({
      formation: column(),
      recipes: tierRecipes,
      projectionRadii: new Map(radii),
    }).projectionRadius;
  TestValidator.equals(
    "the member radius is the largest tier radius with its fallbacks",
    namedFacts([
      [
        "largest",
        () =>
          radius([
            ["member", 0.4],
            ["member-far", 1.2],
          ]) === 1.2,
      ],
      ["borrowsBase", () => radius([["member", 0.4]]) === 0.4],
      ["halfMetre", () => radius([]) === 0.5],
      [
        "centimetreFloor",
        () =>
          radius(
            [["member", 0.001]],
            new Map([["member", recipe("member", [])]]),
          ) === 0.01,
      ],
    ]),
    {
      largest: true,
      borrowsBase: true,
      halfMetre: true,
      centimetreFloor: true,
    },
  );

  // 5. Terrain snapshot. The rank's footprint is x in [-512, 512] at z = 0.
  const under = strip("under", { x: -600, z: 0 }, { x: 600, z: 0 }, 2);
  const alsoUnder = strip("also-under", { x: -10, z: 0 }, { x: 10, z: 0 }, 2);
  const grounded = materializeCompiledFormation({
    formation: column(),
    surfaces: [
      strip("east", { x: 600, z: 0 }, { x: 700, z: 0 }, 2),
      alsoUnder,
      strip("west", { x: -700, z: 0 }, { x: -600, z: 0 }, 2),
      strip("north", { x: -10, z: 7.5 }, { x: 10, z: 7.5 }, 5),
      under,
      strip("south", { x: -10, z: -7.5 }, { x: 10, z: -7.5 }, 5),
    ],
  });
  TestValidator.equals(
    "only terrain reaching the footprint is snapshotted, in declared order",
    namedFacts([
      [
        "reaching",
        () =>
          grounded.ground.map((surface) => surface.id).join(",") ===
          "also-under,under",
      ],
      [
        "levelSummary",
        () =>
          vclose(grounded.bounds.min, compiled.bounds.min, 0) &&
          vclose(grounded.bounds.max, compiled.bounds.max, 0),
      ],
    ]),
    { reaching: true, levelSummary: true },
  );

  // 6. Digest.
  const { digest, ...core } = compiled;
  const { digest: groundedDigest, ...groundedCore } = grounded;
  TestValidator.equals(
    "the digest is the Node digest of the record and follows its input",
    namedFacts([
      ["node", () => digest === nodeDigest(core)],
      ["nodeGrounded", () => groundedDigest === nodeDigest(groundedCore)],
      [
        "repeatable",
        () =>
          materializeCompiledFormation({ formation: column() }).digest ===
          digest,
      ],
      [
        "seed",
        () =>
          materializeCompiledFormation({ formation: column({ seed: 12 }) })
            .digest !== digest,
      ],
      ["terrain", () => groundedDigest !== digest],
    ]),
    {
      node: true,
      nodeGrounded: true,
      repeatable: true,
      seed: true,
      terrain: true,
    },
  );

  // 7. Defaults and refusal.
  TestValidator.equals(
    "defaults compile a bare record and a hero outside the unit refuses",
    namedFacts([
      ["noTerrain", () => compiled.ground.length === 0],
      ["halfMetre", () => compiled.projectionRadius === 0.5],
      [
        "heroOutside",
        () =>
          throwsError(
            () =>
              materializeCompiledFormation({
                formation: column({
                  count: 2,
                  layout: {
                    kind: "line",
                    files: 2,
                    ranks: 1,
                    spacing: { lateral: 1, depth: 1 },
                  },
                  heroOverrides: [{ slot: 5, actor: "outside" }],
                }),
              }),
            'Formation "column" slot 5 is outside 0..1',
          ),
      ],
    ]),
    { noTerrain: true, halfMetre: true, heroOutside: true },
  );
};
