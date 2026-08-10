import {
  IAutoMovieCompiledShotSource,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieShotSourceOutput,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  AUTOMOVIE_INSTANCE_CHUNK_SIZE,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  IAutoMovieExternalModelRuntimeBinding,
  materializeCompiledInstanceSet,
  materializeCompiledInstanceSetInventory,
  materializeCompiledShot,
  materializeInstanceSlot,
  materializeInstanceSlots,
  materializeProductionModels,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  modelRecipe,
  productionCompileSucceeded,
  productionFixture,
  shotContract,
  worldDesign,
} from "./productionFixtures";

interface IProductionInstancesFixtureFailure {
  error: unknown;
}

class ProductionInstancesFixtureCleanupError extends AggregateError {}

/** Dispose the production-instances fixture without replacing its failure. */
export const preserveProductionInstancesFixtureCleanup = (
  failure: IProductionInstancesFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionInstancesFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production-instances fixture teardown failed after the test failed.",
    );
  }
};

const instanceSet = (
  id: string,
  count: number,
  layout: IAutoMovieInstanceSetDesign["layout"],
): IAutoMovieInstanceSetDesign => ({
  id,
  modelRecipe: "soloist",
  count,
  layout,
  anchor: { x: 2, y: 0, z: 3 },
  facingDeg: 20,
  seed: 1_421,
  variation: {
    scale: { min: 0.8, max: 1.2 },
    palette: ["#335522", "#557733", "#779944"],
    traits: [
      { name: "pace", min: 0.5, max: 1.5 },
      { name: "windPhase", min: 0, max: 1 },
      { name: "__proto__", min: 2, max: 3 },
    ],
  },
});

/**
 * General instance sets remain compact and regenerate identically everywhere.
 *
 * The claim under test is that a set of any size is a placement law plus
 * bounded chunks rather than an inventory: every member is derived from seed
 * and slot, the compiled runtime holds no per-member record, and the sandbox a
 * source module runs in derives the same member the compiler did.
 *
 * Scenarios:
 *
 * 1. Grid, scatter and along-route sets derive stable seeded variation, repeat
 *    exactly, and separate on the seed's high word. Negative twins: a negative
 *    slot, an absent route and a non-finite route accumulation each refuse, and
 *    an extreme trait range still interpolates to a finite value.
 * 2. Lattice and explicit sets keep full TRS, a prototype table, stable member ids
 *    and visibility, while a set declaring none of those keeps exactly the
 *    compiled and slot keys it always had.
 * 3. A registered rigid glTF prototype resolves to the sealed external model,
 *    carrying its byte ledger, against a generated prototype of the same set
 *    that stays compiler-owned.
 * 4. Chunking stays bounded and digest-stable, and the compiled inventory resolves
 *    route geometry only where a layout asks for it.
 * 5. The scaffold sandbox regenerates the compiler's own slot for every layout,
 *    proven by an oracle injected into the fixture's shot builder.
 * 6. An explicit member's id is reserved against scene nodes: a node taking a
 *    declared id is reported, including a hidden member's, while the same
 *    prefix with an undeclared id stays an ordinary node.
 */
export const test_mcp_production_instances = (): void => {
  const route = {
    id: "market-road",
    waypoints: [
      { x: -10, z: -5 },
      { x: 0, z: 5 },
      { x: 10, z: -5 },
    ],
    allowedFormationWidth: 3,
  };
  const world: IAutoMovieWorldDesign = {
    ...worldDesign(),
    routes: [route],
  };
  const grid = instanceSet("civilians", 100, {
    kind: "grid",
    rows: 10,
    columns: 10,
    spacing: { x: 1.2, z: 1.4 },
  });
  const scatter = instanceSet("trees", 1_000, {
    kind: "scatter",
    radius: 75,
  });
  const alongRoute = instanceSet("roadside", 12, {
    kind: "along-route",
    route: route.id,
    lateralJitter: 0.75,
  });
  world.instanceSets = [grid, scatter, alongRoute];
  const gridSlots = materializeInstanceSlots(grid, world);
  const scatterSlots = materializeInstanceSlots(scatter, world);
  const repeatedScatter = materializeInstanceSlots(scatter, world);
  const highWordScatter = materializeInstanceSlots(
    { ...scatter, seed: scatter.seed + 4_294_967_296 },
    world,
  );
  const routeSlots = materializeInstanceSlots(alongRoute, world);
  TestValidator.equals(
    "100 civilians, 1000 trees, and route instances derive stable variation",
    namedFacts([
      ["gridSlots", () => gridSlots.length === 100],
      ["scatterSlots000", () => scatterSlots.length === 1_000],
      ["routeSlots", () => routeSlots.length === 12],
      [
        "stringifyScatterSlotsStringify",
        () => JSON.stringify(scatterSlots) === JSON.stringify(repeatedScatter),
      ],
      [
        "stringifyScatterSlotsStringify2",
        () => JSON.stringify(scatterSlots) !== JSON.stringify(highWordScatter),
      ],
      [
        "gridSlotsSlotConst",
        () =>
          gridSlots.every((slot) => {
            const prototypeTrait = Object.getOwnPropertyDescriptor(
              slot.traits,
              "__proto__",
            )?.value;
            return (
              slot.scale >= 0.8 &&
              slot.scale <= 1.2 &&
              slot.palette.startsWith("#") &&
              slot.traits.pace! >= 0.5 &&
              slot.traits.pace! <= 1.5 &&
              typeof prototypeTrait === "number" &&
              prototypeTrait >= 2 &&
              prototypeTrait <= 3
            );
          }),
      ],
      [
        "routeSlotsSlotSlot",
        () =>
          routeSlots.every(
            (slot) => slot.position.x >= -10 && slot.position.x <= 10,
          ),
      ],
    ]),
    {
      gridSlots: true,
      scatterSlots000: true,
      routeSlots: true,
      stringifyScatterSlotsStringify: true,
      stringifyScatterSlotsStringify2: true,
      gridSlotsSlotConst: true,
      routeSlotsSlotSlot: true,
    },
  );
  TestValidator.error("negative instance slot is refused", () =>
    materializeInstanceSlot(grid, world, -1),
  );
  TestValidator.error("missing along-route geometry is refused", () =>
    materializeInstanceSlot(alongRoute, { routes: [] }, 0),
  );
  TestValidator.error("non-finite route accumulation is refused", () =>
    materializeInstanceSlot(
      alongRoute,
      {
        routes: [
          {
            ...route,
            waypoints: [
              { x: -Number.MAX_VALUE, z: 0 },
              { x: Number.MAX_VALUE, z: 0 },
            ],
          },
        ],
      },
      0,
    ),
  );
  const extremeTraitSlot = materializeInstanceSlot(
    {
      ...grid,
      variation: {
        ...grid.variation,
        traits: [
          {
            name: "extreme",
            min: -Number.MAX_VALUE,
            max: Number.MAX_VALUE,
          },
        ],
      },
    },
    world,
    0,
  );
  TestValidator.predicate(
    "overflow-safe interpolation retains a finite direct slot",
    Number.isFinite(extremeTraitSlot.traits.extreme),
  );

  const recipes = new Map([[modelRecipe().id, modelRecipe()]]);
  // A prototype recipe is an ordinary tracked model recipe and answers to the
  // same design gate: an empty `lod` is refused there, so a fixture that
  // declared one would never be written and every prototype reference to it
  // would dangle at compile time.
  const alternateRecipe: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "alternate-prop",
    lod: [{ tier: "hero", maxDistance: null, recipe: "alternate-prop" }],
  };
  recipes.set(alternateRecipe.id, alternateRecipe);
  const lattice: IAutoMovieInstanceSetDesign = {
    ...instanceSet("facade-windows", 10_000, {
      kind: "lattice",
      rows: 100,
      columns: 100,
      layers: 1,
      spacing: { x: 1.25, y: 2, z: 0.1 },
    }),
    prototypes: [
      { id: "alternate", modelRecipe: alternateRecipe.id, weight: 2 },
    ],
    variation: {
      ...instanceSet("unused", 1, {
        kind: "scatter",
        radius: 1,
      }).variation,
      scale3: {
        min: { x: 0.75, y: 0.9, z: 0.5 },
        max: { x: 1.25, y: 1.1, z: 2 },
      },
      rotationDeg: {
        x: { min: -20, max: 20 },
        y: { min: 0, max: 360 },
        z: { min: -45, max: 45 },
      },
      visibleProbability: 0.8,
    },
  };
  const explicit: IAutoMovieInstanceSetDesign = {
    ...instanceSet("spiral-balusters", 3, {
      kind: "explicit",
      transforms: [
        {
          id: "baluster-a",
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 0.2, y: 2, z: 0.2 },
          prototype: "default",
        },
        {
          id: "baluster-b",
          translation: { x: 1, y: 0.5, z: 1 },
          rotation: {
            x: 0,
            y: Math.SQRT1_2,
            z: 0,
            w: Math.SQRT1_2,
          },
          scale: { x: 0.25, y: 2.25, z: 0.25 },
          prototype: "alternate",
          palette: "#abcdef",
          traits: { pace: 1.25 },
        },
        {
          id: "baluster-hidden",
          translation: { x: 2, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 0.2, y: 2.5, z: 0.2 },
          visible: false,
        },
      ],
    }),
    prototypes: [
      { id: "alternate", modelRecipe: alternateRecipe.id, weight: 1 },
    ],
  };
  const latticeSlot = materializeInstanceSlot(lattice, world, 9_999);
  const explicitSlot = materializeInstanceSlot(explicit, world, 1);
  const explicitHidden = materializeInstanceSlot(explicit, world, 2);
  const compiledLattice = materializeCompiledInstanceSet(
    lattice,
    world,
    recipes,
  );
  const compiledExplicit = materializeCompiledInstanceSet(
    explicit,
    world,
    recipes,
  );
  TestValidator.equals(
    "enhanced instance sets retain 3D TRS, prototypes, stable ids and visibility",
    namedFacts([
      ["latticeCount", () => compiledLattice.count === 10_000],
      ["latticeY", () => latticeSlot.position.y === lattice.anchor.y],
      ["latticeRotation", () => latticeSlot.rotation !== undefined],
      [
        "latticeScale3",
        () =>
          latticeSlot.scale3 !== undefined &&
          latticeSlot.scale3.x >= 0.75 &&
          latticeSlot.scale3.z <= 2,
      ],
      ["latticePrototype", () => latticeSlot.prototype !== undefined],
      ["compiledPrototypes", () => compiledLattice.prototypes?.length === 2],
      ["explicitNode", () => explicitSlot.node.endsWith(":baluster-b")],
      ["explicitRecipe", () => explicitSlot.modelRecipe === alternateRecipe.id],
      ["explicitScale", () => explicitSlot.scale3?.y === 2.25],
      ["explicitPalette", () => explicitSlot.palette === "#abcdef"],
      ["explicitTrait", () => explicitSlot.traits.pace === 1.25],
      ["explicitHidden", () => explicitHidden.visible === false],
      [
        "compiledExplicitDigest",
        () => compiledExplicit.digest.startsWith("sha256:"),
      ],
    ]),
    {
      latticeCount: true,
      latticeY: true,
      latticeRotation: true,
      latticeScale3: true,
      latticePrototype: true,
      compiledPrototypes: true,
      explicitNode: true,
      explicitRecipe: true,
      explicitScale: true,
      explicitPalette: true,
      explicitTrait: true,
      explicitHidden: true,
      compiledExplicitDigest: true,
    },
  );
  // A registered rigid glTF is a prototype like any other: the recipe supplies
  // the identity and the manifest-sealed binding supplies the bytes, the LOD
  // members and the measurement envelope the viewer culls against.
  const panelDigest =
    "sha256:0000000000000000000000000000000000000000000000000000000000000001" as const;
  const externalBinding: IAutoMovieExternalModelRuntimeBinding = {
    asset: "public/models/panel.glb",
    profile: "gltf-static-v1",
    lod: [
      {
        level: "near",
        asset: "public/models/panel.glb",
        digest: panelDigest,
        profile: "gltf-static-v1",
        humanoidBones: [],
      },
    ],
    assets: [{ path: "public/models/panel.glb", digest: panelDigest }],
    humanoidBones: [],
    collision: {
      recipe: "box-v1",
      parameters: { width: 1, height: 2, depth: 1 },
    },
    measurement: {
      recipe: "box-v1",
      parameters: { width: 1, height: 2, depth: 1 },
    },
  };
  const externalRecipe: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "registered-panel",
    role: "prop",
    archetype: "primitive-prop",
    parameters: { shape: "box", width: 1, height: 2, depth: 1 },
    capabilities: [],
    attachments: [],
    lod: [{ tier: "near", maxDistance: null, recipe: "registered-panel" }],
  };
  const externalRecipes = new Map([
    [modelRecipe().id, modelRecipe()],
    [externalRecipe.id, externalRecipe],
  ]);
  const externalModels = new Map([[externalRecipe.id, externalBinding]]);
  const externalSet: IAutoMovieInstanceSetDesign = {
    ...instanceSet("registered-panels", 2, {
      kind: "lattice",
      rows: 1,
      columns: 2,
      layers: 1,
      spacing: { x: 1.4, y: 3, z: 0.1 },
    }),
    prototypes: [{ id: "panel", modelRecipe: externalRecipe.id, weight: 1 }],
  };
  const compiledExternal = materializeCompiledInstanceSet(
    externalSet,
    world,
    externalRecipes,
    externalModels,
  );
  const externalRuntime = materializeProductionModels(
    externalRecipes,
    externalModels,
  ).get(externalRecipe.id)!;
  const generatedRuntime = materializeProductionModels(
    externalRecipes,
    externalModels,
  ).get(modelRecipe().id)!;
  TestValidator.equals(
    "a registered rigid glTF prototype resolves to its sealed external model",
    namedFacts([
      [
        "externalPrototypeModel",
        () =>
          compiledExternal.prototypes?.find(
            (prototype) => prototype.id === "panel",
          )?.lod[0]?.model === externalRuntime.id,
      ],
      ["externalOrigin", () => externalRuntime.origin === "imported"],
      ["externalAsset", () => externalRuntime.asset === externalBinding.asset],
      [
        "externalProfile",
        () => externalRuntime.imported?.profile === "gltf-static-v1",
      ],
      [
        // The byte ledger travels with the model, so a host that decodes this
        // prototype is decoding exactly what the compiler sealed.
        "externalClosure",
        () =>
          JSON.stringify(externalRuntime.imported?.assets) ===
          JSON.stringify(externalBinding.assets),
      ],
      [
        // Negative twin: the generated prototype of the same set is untouched
        // by the binding and stays a compiler-owned recipe.
        "generatedUntouched",
        () =>
          generatedRuntime.origin === "generated" &&
          generatedRuntime.asset === null,
      ],
      ["externalProjectionRadius", () => compiledExternal.projectionRadius > 0],
    ]),
    {
      externalPrototypeModel: true,
      externalOrigin: true,
      externalAsset: true,
      externalProfile: true,
      externalClosure: true,
      generatedUntouched: true,
      externalProjectionRadius: true,
    },
  );

  const highCount = {
    ...scatter,
    count: AUTOMOVIE_INSTANCE_CHUNK_SIZE * 2 + 1,
  };
  const compact = materializeCompiledInstanceSet(highCount, world, recipes);
  const compactAgain = materializeCompiledInstanceSet(
    highCount,
    world,
    recipes,
  );
  const inventory = materializeCompiledInstanceSetInventory(world, recipes);
  TestValidator.equals(
    "compiled instance sets retain only bounded chunks and resolved route data",
    namedFacts([
      ["compactChunks", () => compact.chunks.length === 3],
      [
        "compactChunksCount",
        () => compact.chunks[0]?.count === AUTOMOVIE_INSTANCE_CHUNK_SIZE,
      ],
      ["compactChunksCount2", () => compact.chunks[2]?.count === 1],
      [
        "compactDigestCompactAgain",
        () => compact.digest === compactAgain.digest,
      ],
      ["compactProjectionRadius", () => compact.projectionRadius > 0],
      ["keysInventory", () => Object.keys(inventory).length === 3],
      [
        "inventoryRoadsideRoute",
        () => inventory.roadside?.route?.id === route.id,
      ],
      ["inventoryTreesRoute", () => inventory.trees?.route === null],
      [
        // A set that declares none of the expanded features keeps exactly the
        // shape it always had. Every one of these keys is digested, so gaining
        // one would change the compiled bytes of productions already shipped.
        "legacyCompiledKeys",
        () =>
          JSON.stringify(Object.keys(compact)) ===
          JSON.stringify([
            "version",
            "id",
            "count",
            "modelRecipe",
            "layout",
            "route",
            "anchor",
            "facingDeg",
            "seed",
            "variation",
            "bounds",
            "centroid",
            "projectionRadius",
            "chunks",
            "lod",
            "digest",
          ]),
      ],
      [
        "legacySlotKeys",
        () =>
          JSON.stringify(Object.keys(gridSlots[0]!)) ===
          JSON.stringify([
            "slot",
            "node",
            "modelRecipe",
            "position",
            "facingDeg",
            "scale",
            "palette",
            "traits",
          ]),
      ],
      [
        "enhancedCompiledKeys",
        () =>
          JSON.stringify(Object.keys(compiledLattice)) ===
          JSON.stringify([
            "version",
            "id",
            "count",
            "modelRecipe",
            "prototypes",
            "layout",
            "route",
            "anchor",
            "facingDeg",
            "seed",
            "variation",
            "bounds",
            "centroid",
            "projectionRadius",
            "chunks",
            "lod",
            "digest",
          ]),
      ],
    ]),
    {
      compactChunks: true,
      compactChunksCount: true,
      compactChunksCount2: true,
      compactDigestCompactAgain: true,
      compactProjectionRadius: true,
      keysInventory: true,
      inventoryRoadsideRoute: true,
      inventoryTreesRoute: true,
      legacyCompiledKeys: true,
      legacySlotKeys: true,
      enhancedCompiledKeys: true,
    },
  );

  let productionInstancesFailure:
    | IProductionInstancesFixtureFailure
    | undefined;
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const fixtureWorld = project.graph().world!;
    project.setModelRecipe(alternateRecipe);
    project.setWorldDesign({
      ...fixtureWorld,
      routes: [route],
      instanceSets: [grid, scatter, alongRoute, lattice, explicit],
    });
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const source = fs.readFileSync(sourcePath, "utf8");
    // The oracle only proves anything while it is actually injected; a builder
    // signature the scaffold no longer writes would leave this case compiling
    // untouched source and reporting success.
    // A divergence here is a difference in the last bits of a transform, so the
    // refusal has to carry both readings. "diverged" alone names the fact and
    // hides the fact's content, and the sandbox has no other way to report it.
    const oracle = (
      label: string,
      set: string,
      slot: number,
      expected: unknown,
    ): string => `
  {
    const sampled = context.engine.instanceSlot(${JSON.stringify(
      set,
    )}, ${slot});
    const expected = ${JSON.stringify(JSON.stringify(expected))};
    if (JSON.stringify(sampled) !== expected)
      throw new Error(
        ${JSON.stringify(`${label} instance oracle diverged: sandbox `)} +
          JSON.stringify(sampled) +
          " but compiler " +
          expected,
      );
  }`;
    const injected = source.replace(
      "): IAutoMovieProductionShotProgram => {",
      `): IAutoMovieProductionShotProgram => {${oracle(
        "grid",
        "civilians",
        0,
        gridSlots[0],
      )}${oracle("scatter", "trees", 0, scatterSlots[0])}${oracle(
        "route",
        "roadside",
        0,
        routeSlots[0],
      )}${oracle("lattice", "facade-windows", 9_999, latticeSlot)}${oracle(
        "explicit",
        "spiral-balusters",
        1,
        explicitSlot,
      )}`,
    );
    if (injected === source)
      throw new Error("Scaffold source no longer declares a shot builder.");
    fs.writeFileSync(sourcePath, injected);
    const output = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    // The compiled shot is read straight off disk below, so a refused compile
    // has to be reported as the refusal it is. Reading a file the compiler
    // deliberately never wrote replaces the diagnostics that explain the
    // refusal with a bare ENOENT, which names nothing.
    const outputSucceeded = productionCompileSucceeded(
      "world instance fixture",
      output,
    );
    TestValidator.predicate(
      "the world instance fixture compiles before its artifact is read",
      outputSucceeded,
    );
    const compiled = JSON.parse(
      fs.readFileSync(
        path.join(fixture.root, "generated/fixture-film/shots/opening.json"),
        "utf8",
      ),
    ) as IAutoMovieCompiledShotSource;
    TestValidator.equals(
      "compiler and sandbox oracle publish compact world instance runtimes",
      namedFacts([
        ["outputSucceeded", () => outputSucceeded],
        [
          "compiledInstanceSetsLength",
          () => outputSucceeded && compiled.instanceSets.length === 5,
        ],
        [
          "compiledInstanceSetsFind",
          () =>
            outputSucceeded &&
            compiled.instanceSets.length === 5 &&
            compiled.instanceSets.find((item) => item.id === "civilians")
              ?.count === 100,
        ],
        [
          "compiledInstanceSetsFind2",
          () =>
            compiled.instanceSets.find((item) => item.id === "trees")?.count ===
            1_000,
        ],
        [
          "compiledModelsSome",
          () =>
            compiled.models.some((model) => model.id.endsWith(":soloist")) &&
            compiled.models.some((model) =>
              model.id.endsWith(`:${alternateRecipe.id}`),
            ),
        ],
      ]),
      {
        outputSucceeded: true,
        compiledInstanceSetsLength: true,
        compiledInstanceSetsFind: true,
        compiledInstanceSetsFind2: true,
        compiledModelsSome: true,
      },
    );

    // An explicit block names its members, so its identities leave the
    // compiler-owned `slot:NNNNNN` namespace and land in one an author also
    // writes scene nodes into. A node that takes an explicit id would be a
    // second object claiming a transform the batch already draws, so the
    // materializer has to report it exactly as it reports an ordinary slot.
    const {
      models: _collisionModels,
      formations: _collisionFormations,
      ...collisionBase
    } = compiled;
    const shotSource: IAutoMovieShotSourceOutput = collisionBase;
    const explicitWorld = { ...fixtureWorld, instanceSets: [explicit] };
    const explicitRuntime = materializeCompiledInstanceSetInventory(
      explicitWorld,
      recipes,
    );
    const runtimeModels = materializeProductionModels(recipes);
    const materializeWithNode = (
      id: string,
    ): ReturnType<typeof materializeCompiledShot> => {
      const staged = structuredClone(shotSource);
      staged.scene.nodes.push({ ...staged.scene.nodes[0]!, id });
      return materializeCompiledShot({
        contract: shotContract(),
        formations: new Map(),
        instanceSetRuntime: explicitRuntime,
        modelRecipes: recipes,
        runtimeModels,
        world: explicitWorld,
        source: staged,
      });
    };
    const takenIdentity = materializeWithNode(
      "instance:spiral-balusters:baluster-b",
    );
    const freeIdentity = materializeWithNode(
      "instance:spiral-balusters:baluster-z",
    );
    const hiddenIdentity = materializeWithNode(
      "instance:spiral-balusters:baluster-hidden",
    );
    TestValidator.equals(
      "an explicit instance identity is reserved against scene nodes",
      namedFacts([
        [
          "takenIdentityReported",
          () =>
            takenIdentity.collisions.includes(
              "instance:spiral-balusters:baluster-b",
            ),
        ],
        [
          // A hidden member still owns its name: the batch skips drawing it,
          // and an author who reuses the id has still lost the identity the
          // compiled slot publishes.
          "hiddenIdentityReported",
          () =>
            hiddenIdentity.collisions.includes(
              "instance:spiral-balusters:baluster-hidden",
            ),
        ],
        [
          // Negative twin: the same prefix with an id the block never declares
          // is an ordinary node, and reporting it would refuse valid source.
          "freeIdentityAllowed",
          () => freeIdentity.collisions.length === 0,
        ],
        [
          "freeIdentityKept",
          () =>
            freeIdentity.value.scene.nodes.some(
              (node) => node.id === "instance:spiral-balusters:baluster-z",
            ),
        ],
      ]),
      {
        takenIdentityReported: true,
        hiddenIdentityReported: true,
        freeIdentityAllowed: true,
        freeIdentityKept: true,
      },
    );
  } catch (error) {
    productionInstancesFailure = { error };
    throw error;
  } finally {
    preserveProductionInstancesFixtureCleanup(productionInstancesFailure, () =>
      fixture.dispose(),
    );
  }
};
