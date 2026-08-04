import {
  IAutoMovieCompiledShotSource,
  IAutoMovieFormationMotion,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieShotSourceOutput,
} from "@automovie/interface";
import {
  AUTOMOVIE_FORMATION_CHUNK_SIZE,
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  materializeCompiledFormation,
  materializeCompiledFormationInventory,
  materializeCompiledInstanceSetInventory,
  materializeCompiledShot,
  materializeFormationInventory,
  materializeFormationSlot,
  materializeFormationSlots,
  materializeProductionModels,
  productionRuntimeModelId,
  productionRuntimeSkeletonId,
  validateAutoMovieFormationMotions,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  formationDesign,
  modelRecipe,
  productionCompileSucceeded,
  productionFixture,
  setProductionFixtureShotContract,
  shotContract,
  worldDesign,
} from "./productionFixtures";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

interface IProductionMaterializationFixtureFailure {
  error: unknown;
}

class ProductionMaterializationFixtureCleanupError extends AggregateError {}

/** Dispose the materialization fixture without replacing its failure. */
export const preserveProductionMaterializationFixtureCleanup = (
  failure: IProductionMaterializationFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionMaterializationFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production-materialization fixture teardown failed after the test failed.",
    );
  }
};

const recipe = (
  id: string,
  archetype: IAutoMovieModelRecipe["archetype"],
  parameters: IAutoMovieModelRecipe["parameters"],
): IAutoMovieModelRecipe => ({
  ...modelRecipe(),
  id,
  role:
    archetype === "horse"
      ? "mount"
      : archetype === "stickman"
        ? "performer"
        : "prop",
  archetype,
  parameters,
  palette: { body: "#445566" },
  lod: [{ tier: "hero", maxDistance: null, recipe: id }],
  capabilities: archetype === "stickman" ? ["signal"] : [],
  attachments: [],
});

/**
 * Primitive recipes and compact formations materialize as compiler-owned data.
 *
 * Scenarios:
 *
 * 1. Every supported archetype and primitive-prop shape becomes deterministic
 *    model geometry, including a rigged stickman and static battle props.
 * 2. Line, column, wedge, one-member arc, and seeded scatter layouts produce
 *    stable slots, hero identities, anchors, and facing.
 * 3. Shot materialization adds missing slots, repositions an existing hero,
 *    reports formation/general-instance ordinary-slot collisions, and remains
 *    safe when a referenced formation, inventory, model, or source-only model
 *    is absent.
 * 4. A source omitting both optional cue arrays materializes empty effect and
 *    formation-motion streams instead of leaking undefined into compiled data.
 */
export const test_mcp_production_materialization = (): void => {
  const recipes = [
    recipe("stick", "stickman", {
      height: 1.8,
      headRadius: 0.16,
      limbRadius: 0.055,
    }),
    recipe("horse", "horse", {
      length: 2.2,
      height: 1.7,
      legLength: 0.9,
    }),
    recipe("artillery", "artillery", {
      barrelLength: 2.4,
      wheelRadius: 0.55,
      gauge: 1.3,
    }),
    recipe("flag", "flag", {
      width: 0.1,
      height: 0.8,
      poleHeight: 2.2,
    }),
    recipe("weapon", "weapon", {
      length: 1.4,
      thickness: 0.04,
    }),
    recipe("box", "primitive-prop", {
      shape: "box",
      width: 1,
      height: 2,
      depth: 3,
    }),
    recipe("sphere", "primitive-prop", {
      shape: "sphere",
      radius: 1,
    }),
    recipe("capsule", "primitive-prop", {
      shape: "capsule",
      radius: 0.2,
      height: 1,
    }),
    recipe("cylinder", "primitive-prop", {
      shape: "cylinder",
      radius: 0.3,
      height: 1.2,
    }),
    recipe("cone", "primitive-prop", {
      shape: "cone",
      radius: 0.4,
      height: 1.3,
    }),
    recipe("plane", "primitive-prop", {
      shape: "plane",
      width: 2,
      depth: 3,
    }),
  ];
  const models = materializeProductionModels(
    new Map(recipes.map((item) => [item.id, item])),
  );
  TestValidator.equals(
    "all bounded model archetypes materialize",
    namedFacts([
      ["modelsCount", () => models.size === recipes.length],
      [
        "modelsGet",
        () => models.get("stick")?.id === productionRuntimeModelId("stick"),
      ],
      [
        "modelsGet2",
        () =>
          models.get("stick")?.skeleton?.id ===
          productionRuntimeSkeletonId("stick"),
      ],
      ["modelsCount2", () => models.get("stick")?.parts.length === 13],
      ["modelsCount3", () => models.get("horse")?.parts.length === 6],
      ["modelsCount4", () => models.get("artillery")?.parts.length === 3],
      ["modelsCount5", () => models.get("flag")?.parts.length === 2],
      [
        "modelsGet3",
        () => models.get("weapon")?.materials[0]?.metallic === 0.7,
      ],
      [
        "modelsGet4",
        () => models.get("weapon")?.materials[0]?.roughness === 0.35,
      ],
      [
        "modelsGet5",
        () => models.get("box")?.parts[0]?.geometry.type === "primitive",
      ],
      [
        "modelsGet6",
        () => models.get("sphere")?.parts[0]?.geometry.type === "primitive",
      ],
      [
        "modelsGet7",
        () => models.get("capsule")?.parts[0]?.geometry.type === "primitive",
      ],
      [
        "modelsGet8",
        () => models.get("cylinder")?.parts[0]?.geometry.type === "primitive",
      ],
      [
        "modelsGet9",
        () => models.get("cone")?.parts[0]?.geometry.type === "primitive",
      ],
      [
        "modelsGet10",
        () => models.get("plane")?.parts[0]?.geometry.type === "primitive",
      ],
      [
        "boxSphere",
        () =>
          ["box", "sphere", "capsule", "cylinder", "cone", "plane"].every(
            (id) => {
              const geometry = models.get(id)?.parts[0]?.geometry;
              return (
                geometry?.type === "primitive" && geometry.shape.type === id
              );
            },
          ),
      ],
    ]),
    {
      modelsCount: true,
      modelsGet: true,
      modelsGet2: true,
      modelsCount2: true,
      modelsCount3: true,
      modelsCount4: true,
      modelsCount5: true,
      modelsGet3: true,
      modelsGet4: true,
      modelsGet5: true,
      modelsGet6: true,
      modelsGet7: true,
      modelsGet8: true,
      modelsGet9: true,
      modelsGet10: true,
      boxSphere: true,
    },
  );
  const recipeMap = new Map(recipes.map((item) => [item.id, item]));
  const projectionRadii = recipes.map(
    (item, index) =>
      materializeCompiledFormation(
        {
          ...formationDesign(),
          id: `projection-${index}`,
          modelRecipe: item.id,
        },
        recipeMap,
      ).projectionRadius,
  );
  const invalidProjectionRecipe = {
    ...recipes.find((item) => item.id === "box")!,
    id: "invalid-projection",
    parameters: {
      shape: "box",
      width: "invalid",
      height: Number.NaN,
      depth: 1,
    },
    lod: [
      {
        tier: "near" as const,
        maxDistance: null,
        recipe: "invalid-projection",
      },
    ],
  };
  const boundedInvalidProjection = materializeCompiledFormation(
    {
      ...formationDesign(),
      id: "invalid-projection",
      modelRecipe: invalidProjectionRecipe.id,
    },
    new Map([[invalidProjectionRecipe.id, invalidProjectionRecipe]]),
  );
  TestValidator.predicate(
    "every runtime recipe derives a finite projection proxy with a safe malformed fallback",
    projectionRadii.every((radius) => Number.isFinite(radius) && radius > 0) &&
      boundedInvalidProjection.projectionRadius === 0.5,
  );

  const layouts = [
    formationDesign({
      kind: "line",
      ranks: 2,
      files: 3,
      spacing: { lateral: 0.8, depth: 0.9 },
    }),
    {
      ...formationDesign({
        kind: "column",
        ranks: 2,
        files: 3,
        spacing: { lateral: 0.8, depth: 0.9 },
      }),
      id: "column",
    },
    {
      ...formationDesign({
        kind: "wedge",
        depth: 3,
        spacing: { lateral: 0.8, depth: 0.9 },
      }),
      id: "wedge",
    },
    {
      ...formationDesign({ kind: "arc", radius: 4, arcDegrees: 120 }),
      id: "arc-one",
      count: 1,
      facingDeg: 90,
      heroOverrides: [{ slot: 0, actor: "arc-hero" }],
    },
    {
      ...formationDesign({ kind: "scatter", radius: 5, seed: 9 }),
      id: "scatter",
    },
  ];
  const slotSets = layouts.map(materializeFormationSlots);
  const repeatedScatter = materializeFormationSlots(layouts[4]!);
  const swappedScatter = materializeFormationSlots({
    ...layouts[4]!,
    seed: 9,
    layout: { kind: "scatter", radius: 5, seed: 7 },
  });
  const highWordScatter = materializeFormationSlots({
    ...layouts[4]!,
    seed: layouts[4]!.seed + 4_294_967_296,
  });
  const inventory = materializeFormationInventory(
    new Map(layouts.map((item) => [item.id, item])),
  );
  TestValidator.equals(
    "every compact formation layout has deterministic slots",
    namedFacts([
      [
        "slotSetsCount",
        () =>
          slotSets.every(
            (slots, index) => slots.length === layouts[index]!.count,
          ),
      ],
      ["slotSetsNode", () => slotSets[0]![0]?.node === "captain"],
      ["slotSetsNode2", () => slotSets[3]![0]?.node === "arc-hero"],
      ["absSlotSets", () => Math.abs(slotSets[3]![0]!.position.x - 4) < 1e-12],
      ["absSlotSets2", () => Math.abs(slotSets[3]![0]!.position.z) < 1e-12],
      [
        "stringifySlotSets",
        () => JSON.stringify(slotSets[4]) === JSON.stringify(repeatedScatter),
      ],
      [
        "stringifySlotSets2",
        () => JSON.stringify(slotSets[4]) !== JSON.stringify(swappedScatter),
      ],
      [
        "stringifySlotSets3",
        () => JSON.stringify(slotSets[4]) !== JSON.stringify(highWordScatter),
      ],
      [
        "inventoryCount",
        () => Object.keys(inventory).length === layouts.length,
      ],
    ]),
    {
      slotSetsCount: true,
      slotSetsNode: true,
      slotSetsNode2: true,
      absSlotSets: true,
      absSlotSets2: true,
      stringifySlotSets: true,
      stringifySlotSets2: true,
      stringifySlotSets3: true,
      inventoryCount: true,
    },
  );

  let productionMaterializationFailure:
    | IProductionMaterializationFixtureFailure
    | undefined;
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    TestValidator.predicate(
      "materialization fixture compiles",
      productionCompileSucceeded(
        "materialization fixture",
        compiler.compile({ scope: "source" }),
      ),
    );
    const compiled = JSON.parse(
      fs.readFileSync(
        path.join(fixture.root, "generated/fixture-film/shots/opening.json"),
        "utf8",
      ),
    ) as IAutoMovieCompiledShotSource;
    const {
      models: _compiledModels,
      formations: _compiledFormations,
      ...baseSource
    } = compiled;
    const source: IAutoMovieShotSourceOutput = baseSource;
    const formation = formationDesign();
    const contract = {
      ...shotContract(),
      participants: [
        { kind: "actor" as const, id: "sentinel" },
        { kind: "formation" as const, id: formation.id },
      ],
    };
    const formationMap = new Map([[formation.id, formation]]);
    const formationSlots = materializeFormationInventory(formationMap);
    const formationRuntime = materializeCompiledFormationInventory(
      formationMap,
      new Map([[modelRecipe().id, modelRecipe()]]),
    );
    const runtimeModels = materializeProductionModels(
      new Map([[modelRecipe().id, modelRecipe()]]),
    );
    const generalInstances: IAutoMovieInstanceSetDesign = {
      id: "trees",
      modelRecipe: modelRecipe().id,
      count: 2,
      layout: { kind: "scatter", radius: 2 },
      anchor: { x: 0, y: 0, z: 0 },
      facingDeg: 0,
      seed: 9,
      variation: {
        scale: { min: 0.9, max: 1.1 },
        palette: ["#335522"],
        traits: [],
      },
    };
    const instanceWorld = {
      ...worldDesign(),
      instanceSets: [generalInstances],
    };
    const instanceSetRuntime = materializeCompiledInstanceSetInventory(
      instanceWorld,
      new Map([[modelRecipe().id, modelRecipe()]]),
    );
    const heroSource = structuredClone(source);
    heroSource.scene.nodes.push({
      ...heroSource.scene.nodes[0]!,
      id: "captain",
      model: "source-only-model",
      transform: {
        ...heroSource.scene.nodes[0]!.transform,
        translation: { x: 99, y: 99, z: 99 },
      },
    });
    heroSource.scene.nodes.push({
      ...heroSource.scene.nodes[0]!,
      id: "source-only-model-node",
      model: "source-only-model",
    });
    const materialized = materializeCompiledShot({
      contract,
      formations: formationMap,
      formationRuntime,
      modelRecipes: new Map([[modelRecipe().id, modelRecipe()]]),
      runtimeModels,
      source: heroSource,
    });
    const cueState = {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    };
    const validCue: IAutoMovieFormationMotion = {
      id: "line-hold",
      formation: formation.id,
      action: "hold",
      start: 0,
      end: 1,
      from: cueState,
      to: cueState,
      easing: "linear",
    };
    const cueDiagnostics = (
      cues: IAutoMovieFormationMotion[],
      formations = materialized.value.formations,
    ) =>
      validateAutoMovieFormationMotions(contract, {
        ...materialized.value,
        formations,
        formationMotions: cues,
      });
    const validCueDiagnostics = cueDiagnostics([
      validCue,
      { ...validCue, id: "line-hold-later", start: 2, end: 3 },
    ]);
    const invalidCueDiagnostics = [
      ...cueDiagnostics(
        Array.from({ length: 257 }, (_, index) => ({
          ...validCue,
          id: `crowd-cue-${index}`,
        })),
      ),
      ...cueDiagnostics([validCue, { ...validCue, start: 0.5, end: 1.5 }]),
      ...cueDiagnostics([{ ...validCue, id: "" }]),
      ...cueDiagnostics([{ ...validCue, formation: "ghost" }]),
      ...cueDiagnostics([validCue], []),
      ...[
        { start: Number.NaN, end: 1 },
        { start: 0, end: Number.NaN },
        { start: -1, end: 1 },
        { start: 1, end: 1 },
        { start: 0, end: contract.durationSeconds + 1 },
      ].flatMap((time, index) =>
        cueDiagnostics([
          {
            ...validCue,
            id: `invalid-time-${index}`,
            ...time,
          },
        ]),
      ),
      ...cueDiagnostics([
        {
          ...validCue,
          id: "invalid-state",
          from: {
            ...cueState,
            translation: { ...cueState.translation, x: Number.NaN },
          },
        },
        {
          ...validCue,
          id: "unbounded-state",
          start: 2,
          end: 3,
          to: {
            ...cueState,
            translation: { ...cueState.translation, x: 1_000_000_001 },
            facingOffsetDeg: 360_001,
          },
        },
      ]),
      ...[Number.NaN, 0.1, 5].flatMap((lateral, index) =>
        cueDiagnostics([
          {
            ...validCue,
            id: `invalid-spacing-${index}`,
            to: {
              ...cueState,
              spacingScale: { ...cueState.spacingScale, lateral },
            },
          },
        ]),
      ),
    ];
    TestValidator.predicate(
      "formation motion validation accepts bounded cues and rejects every unsafe class",
      validCueDiagnostics.length === 0 &&
        [
          "at most 256",
          "unique inside the shot",
          "participating compiled formation",
          "positive interval",
          "translation inside +/-1000000000m",
          "0.25..4",
          "must not overlap",
        ].every((message) =>
          invalidCueDiagnostics.some((diagnostic) =>
            diagnostic.message.includes(message),
          ),
        ),
    );
    const collisionSource = structuredClone(source);
    collisionSource.scene.nodes.push({
      ...collisionSource.scene.nodes[0]!,
      id: "formation:line:slot:000001",
    });
    const collision = materializeCompiledShot({
      contract,
      formations: formationMap,
      formationRuntime,
      modelRecipes: new Map([[modelRecipe().id, modelRecipe()]]),
      runtimeModels,
      source: collisionSource,
    });
    const instanceCollisionSource = structuredClone(source);
    instanceCollisionSource.scene.nodes.push({
      ...instanceCollisionSource.scene.nodes[0]!,
      id: "instance:trees:slot:000001",
    });
    const instanceCollision = materializeCompiledShot({
      contract: shotContract(),
      formations: new Map(),
      instanceSetRuntime,
      modelRecipes: new Map([[modelRecipe().id, modelRecipe()]]),
      runtimeModels,
      world: instanceWorld,
      source: instanceCollisionSource,
    });
    const absentFormation = materializeCompiledShot({
      contract,
      formations: new Map(),
      runtimeModels,
      source,
    });
    const absentModel = materializeCompiledShot({
      contract,
      formations: formationMap,
      formationRuntime,
      runtimeModels: new Map(),
      source,
    });
    const optionalCueSource = structuredClone(source);
    delete optionalCueSource.effectCues;
    delete optionalCueSource.formationMotions;
    const defaultedCues = materializeCompiledShot({
      contract,
      formations: new Map(),
      runtimeModels,
      source: optionalCueSource,
    });
    TestValidator.equals(
      "compiler owns compact anonymous batches, hero placement and collision reporting",
      namedFacts([
        [
          "materializedScene",
          () =>
            materialized.value.scene.nodes.find((node) => node.id === "captain")
              ?.transform.translation.x === formationSlots.line![0]!.position.x,
        ],
        [
          "materializedScene2",
          () =>
            materialized.value.scene.nodes.find((node) => node.id === "captain")
              ?.model === productionRuntimeModelId(formation.modelRecipe),
        ],
        [
          "materializedModels",
          () =>
            materialized.value.models.every(
              (model) => model.id !== "source-only-model",
            ),
        ],
        [
          "materializedFormations",
          () =>
            materialized.value.formations[0]?.anonymousCount ===
            formation.count - 1,
        ],
        [
          "materializedScene3",
          () =>
            materialized.value.scene.nodes.every(
              (node) => node.id !== "formation:line:slot:000001",
            ),
        ],
        [
          "collisionCollisions",
          () => collision.collisions.includes("formation:line:slot:000001"),
        ],
        [
          "instanceCollisionCollisions",
          () =>
            instanceCollision.collisions.includes("instance:trees:slot:000001"),
        ],
        [
          "absentFormationCount",
          () =>
            absentFormation.value.scene.nodes.length ===
            source.scene.nodes.length,
        ],
        [
          "absentModelCount",
          () =>
            absentModel.value.scene.nodes.length === source.scene.nodes.length,
        ],
        ["defaultedCuesCount", () => defaultedCues.value.effects.length === 0],
        [
          "defaultedCuesCount2",
          () => defaultedCues.value.formationMotions.length === 0,
        ],
      ]),
      {
        materializedScene: true,
        materializedScene2: true,
        materializedModels: true,
        materializedFormations: true,
        materializedScene3: true,
        collisionCollisions: true,
        instanceCollisionCollisions: true,
        absentFormationCount: true,
        absentModelCount: true,
        defaultedCuesCount: true,
        defaultedCuesCount2: true,
      },
    );

    const highCount = {
      ...formation,
      id: "high-count",
      count: AUTOMOVIE_FORMATION_CHUNK_SIZE * 2 + 1,
      layout: {
        kind: "line" as const,
        ranks: 3,
        files: AUTOMOVIE_FORMATION_CHUNK_SIZE,
        spacing: { lateral: 0.8, depth: 0.9 },
      },
      heroOverrides: [
        { slot: AUTOMOVIE_FORMATION_CHUNK_SIZE, actor: "boundary-hero" },
      ],
    };
    const compact = materializeCompiledFormation(
      highCount,
      new Map([[modelRecipe().id, modelRecipe()]]),
    );
    const compactAgain = materializeCompiledFormation(
      highCount,
      new Map([[modelRecipe().id, modelRecipe()]]),
    );
    const firstRegeneratedSlot = materializeFormationSlot(highCount, 0);
    const repeatedRegeneratedSlot = materializeFormationSlot(
      { ...highCount },
      0,
    );
    TestValidator.equals(
      "high counts stay compact across stable chunk boundaries and exact slot regeneration",
      namedFacts([
        [
          "compactCount",
          () => compact.count === AUTOMOVIE_FORMATION_CHUNK_SIZE * 2 + 1,
        ],
        ["compactCount2", () => compact.chunks.length === 3],
        [
          "compactChunks",
          () => compact.chunks[0]?.count === AUTOMOVIE_FORMATION_CHUNK_SIZE,
        ],
        [
          "compactChunks2",
          () => compact.chunks[1]?.start === AUTOMOVIE_FORMATION_CHUNK_SIZE,
        ],
        [
          "compactChunks3",
          () =>
            compact.chunks[1]?.anonymousCount ===
            AUTOMOVIE_FORMATION_CHUNK_SIZE - 1,
        ],
        ["compactChunks4", () => compact.chunks[2]?.count === 1],
        [
          "compactHeroes",
          () => compact.heroes[0]?.slot === AUTOMOVIE_FORMATION_CHUNK_SIZE,
        ],
        ["compactDigest", () => compact.digest === compactAgain.digest],
        [
          "materializeFormationSlotHighCount",
          () =>
            materializeFormationSlot(highCount, AUTOMOVIE_FORMATION_CHUNK_SIZE)
              .actor === "boundary-hero",
        ],
        [
          "firstRegeneratedSlotMotionPhase",
          () =>
            firstRegeneratedSlot.motionPhase ===
            repeatedRegeneratedSlot.motionPhase,
        ],
        [
          "tryMaterializeFormationSlot",
          () =>
            (() => {
              try {
                materializeFormationSlot(highCount, highCount.count);
                return false;
              } catch {
                return true;
              }
            })(),
        ],
      ]),
      {
        compactCount: true,
        compactCount2: true,
        compactChunks: true,
        compactChunks2: true,
        compactChunks3: true,
        compactChunks4: true,
        compactHeroes: true,
        compactDigest: true,
        materializeFormationSlotHighCount: true,
        firstRegeneratedSlotMotionPhase: true,
        tryMaterializeFormationSlot: true,
      },
    );
    project.setFormationDesign(highCount);
    setProductionFixtureShotContract(project, {
      ...shotContract(),
      participants: [
        ...shotContract().participants,
        { kind: "formation", id: highCount.id },
      ],
    });
    const openingSourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const openingSource = fs
      .readFileSync(openingSourcePath, "utf8")
      .replace(
        "  const model = context.runtimeModels.sentinel;",
        `  const boundary = context.engine.formationSlot("${highCount.id}", ${highCount.count - 1});
  if (boundary.slot !== ${highCount.count - 1}) throw new Error("formation slot mismatch");
  const model = context.runtimeModels.sentinel;`,
      )
      .replaceAll('"army"', `"${highCount.id}"`);
    fs.writeFileSync(openingSourcePath, openingSource);
    const highCountCompile = compiler.compile({ scope: "source" });
    const highCountCompileSucceeded = productionCompileSucceeded(
      "high-count formation fixture",
      highCountCompile,
    );
    const highCountShot = highCountCompileSucceeded
      ? (JSON.parse(
          fs.readFileSync(
            path.join(
              fixture.root,
              "generated/fixture-film/shots/opening.json",
            ),
            "utf8",
          ),
        ) as IAutoMovieCompiledShotSource)
      : null;
    const highCountSummary = new AutoMovieProductionOracleService(
      project,
    ).query({
      request: {
        query: "formation",
        formation: highCount.id,
        shot: "opening",
        time: 3,
      },
    });
    TestValidator.equals(
      "shot sandbox regenerates a high slot and preserves one compact formation motion",
      namedFacts([
        ["highCountCompileSucceeded", () => highCountCompileSucceeded],
        [
          "highCountShotFormations",
          () => highCountShot?.formations[0]?.count === highCount.count,
        ],
        [
          "highCountShotScene",
          () =>
            highCountShot.scene.nodes.every(
              (node) =>
                node.id !==
                `formation:${highCount.id}:slot:${String(highCount.count - 1).padStart(6, "0")}`,
            ),
        ],
        [
          "highCountShotFormationMotions",
          () => highCountShot.formationMotions[0]?.formation === highCount.id,
        ],
        [
          "highCountShotFormationMotions2",
          () => highCountShot.formationMotions[0]?.action === "advance",
        ],
        [
          "highCountSummaryResult",
          () => highCountSummary.result?.kind === "measurement",
        ],
        [
          "highCountSummaryResult2",
          () => highCountSummary.result.values.motionOffsetZ === -1,
        ],
        [
          "highCountSummaryResult3",
          () => highCountSummary.result.values.motionFacingOffsetDeg === 2,
        ],
        [
          "highCountSummaryResult4",
          () => highCountSummary.result.values.lateralSpacingScale === 1.025,
        ],
        [
          "highCountSummaryResult5",
          () =>
            Number(highCountSummary.result.values.minimumProjectedPixels) > 0,
        ],
        [
          "highCountSummaryCount",
          () =>
            Number(highCountSummary.result.values.nearVisible) +
              Number(highCountSummary.result.values.farVisible) +
              Number(highCountSummary.result.values.culled) ===
            highCount.count - highCount.heroOverrides.length,
        ],
      ]),
      {
        highCountCompileSucceeded: true,
        highCountShotFormations: true,
        highCountShotScene: true,
        highCountShotFormationMotions: true,
        highCountShotFormationMotions2: true,
        highCountSummaryResult: true,
        highCountSummaryResult2: true,
        highCountSummaryResult3: true,
        highCountSummaryResult4: true,
        highCountSummaryResult5: true,
        highCountSummaryCount: true,
      },
    );
  } catch (error) {
    productionMaterializationFailure = { error };
    throw error;
  } finally {
    preserveProductionMaterializationFixtureCleanup(
      productionMaterializationFailure,
      () => fixture.dispose(),
    );
  }
};
