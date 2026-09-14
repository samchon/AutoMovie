import {
  AUTOMOVIE_INSTANCE_CHUNK_SIZE,
  materializeCompiledInstanceSet,
} from "@automovie/engine";
import {
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieWorldRoute,
} from "@automovie/interface";
import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError, vclose } from "../internal/predicates";

/** One chunk plus one member in a single row, one metre apart along x. */
const row = (
  overrides: Partial<IAutoMovieInstanceSetDesign> = {},
): IAutoMovieInstanceSetDesign => ({
  id: "hedge",
  modelRecipe: "tree",
  count: AUTOMOVIE_INSTANCE_CHUNK_SIZE + 1,
  layout: {
    kind: "grid",
    rows: 1,
    columns: AUTOMOVIE_INSTANCE_CHUNK_SIZE + 1,
    spacing: { x: 1, z: 1 },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 3,
  variation: { scale: { min: 1, max: 1 }, palette: ["#2f6f2f"], traits: [] },
  ...overrides,
});

const lane: IAutoMovieWorldRoute = {
  id: "lane",
  waypoints: [
    { x: 0, z: 0 },
    { x: 20, z: 0 },
  ],
  allowedFormationWidth: 3,
};

/** A tree declaring a hero tier and a near tier of itself. */
const recipes = new Map<string, IAutoMovieModelRecipe>([
  [
    "tree",
    {
      id: "tree",
      role: "set",
      archetype: "primitive",
      parameters: { height: 4 },
      palette: { leaf: "#2f6f2f" },
      lod: [
        { tier: "hero", maxDistance: 5, recipe: "tree-hero" },
        { tier: "near", maxDistance: 20, recipe: "tree" },
      ],
      capabilities: [],
      attachments: [],
    },
  ],
]);

const nodeDigest = (value: unknown): string =>
  digestAutoMovieBytes(canonicalAutoMovieJsonBytes(value));

/**
 * An instance set compiles to a compact record that keeps its laws, its route
 * snapshot and one resolved prototype table, and to the same record wherever it
 * compiles.
 *
 * Expectations are hand geometry on one row of 1,025 members a metre apart,
 * declared weights and radii, or the Node builder's digest of canonical JSON.
 *
 * Scenarios:
 *
 * 1. One member past a chunk makes two chunks with exact bounds and centroids.
 * 2. Without a prototype table the record names none and takes its radius and
 *    tiers from the base recipe, keeping a declared hero tier that a formation
 *    would drop, because an instance set has no heroes.
 * 3. A table of tall 2 and short 1 compiles with the default first at weight one;
 *    a prototype whose recipe is undeclared draws through one near tier of it,
 *    each prototype takes its own radius, and the set's radius is the largest.
 * 4. A route layout snapshots its route as a copy, a local layout records none,
 *    and the laws are copied rather than shared with the design.
 * 5. An unavailable route and a route of no length refuse compilation.
 * 6. The digest is the Node digest of every other field, repeatable, and
 *    different for another seed; omitted recipes and radii compile one near tier
 *    of the base recipe at half a metre.
 */
export const test_engine_compiled_instance_set_runtime = (): void => {
  // 1. Chunks.
  const compiled = materializeCompiledInstanceSet({
    instanceSet: row(),
    world: { routes: [] },
    recipes,
    projectionRadii: new Map([["tree", 1.5]]),
  });
  const [first, last] = compiled.chunks;
  TestValidator.equals(
    "one member past a chunk compiles to two exact chunks",
    namedFacts([
      ["two", () => compiled.chunks.length === 2],
      ["firstRange", () => first!.start === 0 && first!.count === 1_024],
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
      ["lastRange", () => last!.start === 1_024 && last!.count === 1],
      ["lastCentroid", () => vclose(last!.centroid, { x: 512, y: 0, z: 0 }, 0)],
      [
        "totalCentroid",
        () => vclose(compiled.centroid, { x: 0, y: 0, z: 0 }, 1e-9),
      ],
    ]),
    {
      two: true,
      firstRange: true,
      firstBounds: true,
      firstCentroid: true,
      lastRange: true,
      lastCentroid: true,
      totalCentroid: true,
    },
  );

  // 2. No table.
  TestValidator.equals(
    "a set without a table keeps the base recipe's tiers and radius",
    namedFacts([
      ["noTable", () => Object.hasOwn(compiled, "prototypes") === false],
      [
        "tiers",
        () => compiled.lod.map((item) => item.tier).join(",") === "hero,near",
      ],
      [
        "heroTierDigest",
        () =>
          compiled.lod[0]!.recipeDigest ===
          nodeDigest({ id: "tree-hero", missing: true }),
      ],
      ["radius", () => compiled.projectionRadius === 1.5],
    ]),
    { noTable: true, tiers: true, heroTierDigest: true, radius: true },
  );

  // 3. Table.
  const tabled = materializeCompiledInstanceSet({
    instanceSet: row({
      prototypes: [
        { id: "tall", modelRecipe: "tall-tree", weight: 2 },
        { id: "short", modelRecipe: "shrub", weight: 1 },
      ],
    }),
    world: { routes: [] },
    recipes,
    projectionRadii: new Map([
      ["tree", 1.5],
      ["tall-tree", 3],
      ["shrub", 0.25],
    ]),
  });
  const [base, tall, short] = tabled.prototypes!;
  TestValidator.equals(
    "a declared table compiles with the default first at weight one",
    namedFacts([
      [
        "order",
        () =>
          tabled.prototypes!.map((prototype) => prototype.id).join(",") ===
          "default,tall,short",
      ],
      [
        "weights",
        () => base!.weight === 1 && tall!.weight === 2 && short!.weight === 1,
      ],
      [
        "recipes",
        () =>
          base!.modelRecipe === "tree" &&
          tall!.modelRecipe === "tall-tree" &&
          short!.modelRecipe === "shrub",
      ],
      [
        "undeclaredDrawsNear",
        () =>
          tall!.lod.length === 1 &&
          tall!.lod[0]!.tier === "near" &&
          tall!.lod[0]!.recipe === "tall-tree",
      ],
      [
        "ownRadii",
        () =>
          base!.projectionRadius === 1.5 &&
          tall!.projectionRadius === 3 &&
          short!.projectionRadius === 0.25,
      ],
      ["largest", () => tabled.projectionRadius === 3],
      [
        "baseTiers",
        () =>
          tabled.lod.map((item) => item.recipe).join(",") === "tree-hero,tree",
      ],
    ]),
    {
      order: true,
      weights: true,
      recipes: true,
      undeclaredDrawsNear: true,
      ownRadii: true,
      largest: true,
      baseTiers: true,
    },
  );

  // 4. Route snapshot and copied laws.
  const alongDesign = row({
    count: 4,
    layout: { kind: "along-route", route: "lane", lateralJitter: 0.5 },
  });
  const along = materializeCompiledInstanceSet({
    instanceSet: alongDesign,
    world: { routes: [lane] },
  });
  TestValidator.equals(
    "a route layout snapshots its route and the laws are copies",
    namedFacts([
      [
        "snapshot",
        () =>
          along.route !== null &&
          along.route !== lane &&
          along.route.waypoints.length === 2 &&
          along.route.id === "lane",
      ],
      ["localRecordsNone", () => compiled.route === null],
      [
        "layoutCopied",
        () =>
          along.layout !== alongDesign.layout &&
          along.layout.kind === "along-route",
      ],
      [
        "variationCopied",
        () =>
          along.variation !== alongDesign.variation &&
          along.variation.palette[0] === "#2f6f2f",
      ],
    ]),
    {
      snapshot: true,
      localRecordsNone: true,
      layoutCopied: true,
      variationCopied: true,
    },
  );

  // 5. Refusals.
  TestValidator.equals(
    "an unavailable or zero-length route refuses compilation",
    namedFacts([
      [
        "unavailable",
        () =>
          throwsError(
            () =>
              materializeCompiledInstanceSet({
                instanceSet: alongDesign,
                world: { routes: [] },
              }),
            'references unavailable route "lane"',
          ),
      ],
      [
        "zeroLength",
        () =>
          throwsError(
            () =>
              materializeCompiledInstanceSet({
                instanceSet: alongDesign,
                world: {
                  routes: [
                    {
                      ...lane,
                      waypoints: [
                        { x: 5, z: 5 },
                        { x: 5, z: 5 },
                      ],
                    },
                  ],
                },
              }),
            'route "lane" must have finite non-zero length',
          ),
      ],
    ]),
    { unavailable: true, zeroLength: true },
  );

  // 6. Digest and defaults.
  const { digest, ...core } = compiled;
  const bare = materializeCompiledInstanceSet({
    instanceSet: row(),
    world: { routes: [] },
  });
  TestValidator.equals(
    "the digest is the Node digest of the record and defaults compile a bare record",
    namedFacts([
      ["node", () => digest === nodeDigest(core)],
      [
        "repeatable",
        () =>
          materializeCompiledInstanceSet({
            instanceSet: row(),
            world: { routes: [] },
            recipes,
            projectionRadii: new Map([["tree", 1.5]]),
          }).digest === digest,
      ],
      [
        "seed",
        () =>
          materializeCompiledInstanceSet({
            instanceSet: row({ seed: 4 }),
            world: { routes: [] },
            recipes,
            projectionRadii: new Map([["tree", 1.5]]),
          }).digest !== digest,
      ],
      [
        "bareTier",
        () =>
          bare.lod.length === 1 &&
          bare.lod[0]!.tier === "near" &&
          bare.lod[0]!.recipeDigest ===
            nodeDigest({ id: "tree", missing: true }),
      ],
      ["bareRadius", () => bare.projectionRadius === 0.5],
    ]),
    {
      node: true,
      repeatable: true,
      seed: true,
      bareTier: true,
      bareRadius: true,
    },
  );
};
