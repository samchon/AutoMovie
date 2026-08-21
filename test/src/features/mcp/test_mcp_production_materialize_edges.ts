import {
  IAutoMovieFormationDesign,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieShotSourceOutput,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  IAutoMovieExternalModelRuntimeBinding,
  materializeCompiledEffects,
  materializeCompiledFormation,
  materializeCompiledFormationInventory,
  materializeCompiledInstanceSet,
  materializeCompiledInstanceSetInventory,
  materializeCompiledShot,
  materializeInstanceSlot,
  materializeProductionModels,
  productionRuntimeModelId,
  productionRuntimeSkeletonId,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { compiledShotFixture } from "../internal/renderBudgetFixtures";
import { sceneFixture } from "../internal/renderFixtures";
import {
  formationDesign,
  modelRecipe,
  shotContract,
  worldDesign,
} from "./productionFixtures";

const instanceDesign = (
  overrides: Partial<IAutoMovieInstanceSetDesign> = {},
): IAutoMovieInstanceSetDesign => ({
  id: "edge-instances",
  modelRecipe: "soloist",
  count: 2,
  layout: {
    kind: "grid",
    rows: 1,
    columns: 2,
    spacing: { x: 1, z: 1 },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 19,
  variation: {
    scale: { min: 1, max: 1 },
    palette: ["#ffffff"],
    traits: [],
  },
  ...overrides,
});

const externalBinding = (props: {
  collision: IAutoMovieExternalModelRuntimeBinding["collision"];
  measurement: IAutoMovieExternalModelRuntimeBinding["measurement"];
}): IAutoMovieExternalModelRuntimeBinding => ({
  asset: "assets/models/fixture.glb",
  profile: "gltf-static-v1",
  lod: [],
  assets: [],
  humanoidBones: [],
  collision: props.collision,
  measurement: props.measurement,
});

const sourceNode = (id: string, model: string) => ({
  id,
  model,
  transform: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  motion: null,
  pose: null,
});

/**
 * Compiler materialization keeps its refusal and compact-inventory boundaries
 * reachable without asking a full project compile to manufacture malformed
 * inputs that the design validator correctly rejects first.
 *
 * Scenarios:
 *
 * 1. Non-empty formation and instance inventories preserve canonical ids.
 * 2. Slot regeneration refuses every range, palette, explicit-placement,
 *    prototype, and route failure independently.
 * 3. Imported box/capsule collision proxies and box/humanoid measurement
 *    envelopes survive materialization, while an unregistered archetype is an
 *    explicit compiler refusal and an unencodable LOD recipe receives a stable
 *    marker digest.
 * 4. Shot materialization covers present, absent, precompiled, and fallback
 *    formations; existing and new heroes; ordinary and explicit instance
 *    collisions; prototype and default LOD inventories; authored, runtime, and
 *    missing models.
 */
export const test_mcp_production_materialize_edges = (): void => {
  const baseRecipe = modelRecipe();
  const recipes = new Map([[baseRecipe.id, baseRecipe]]);
  const formation = {
    ...formationDesign(),
    heroOverrides: [
      { slot: 0, actor: "captain" },
      { slot: 2, actor: "recruit" },
    ],
  };
  const grid = instanceDesign();
  const world: IAutoMovieWorldDesign = {
    ...worldDesign(),
    routes: [],
    instanceSets: [grid],
  };
  const formationInventory = materializeCompiledFormationInventory(
    new Map([[formation.id, formation]]),
    recipes,
  );
  const instanceInventory = materializeCompiledInstanceSetInventory(
    world,
    recipes,
  );

  const explicit = instanceDesign({
    id: "explicit",
    layout: {
      kind: "explicit",
      transforms: [
        {
          id: "first",
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
          prototype: "default",
        },
        {
          id: "second",
          translation: { x: 1, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
      ],
    },
  });
  const missingTransform = {
    ...explicit,
    id: "missing-transform",
    layout: {
      kind: "explicit" as const,
      transforms:
        explicit.layout.kind === "explicit"
          ? explicit.layout.transforms.slice(0, 1)
          : [],
    },
  };
  const missingPrototype = {
    ...explicit,
    id: "missing-prototype",
    layout: {
      kind: "explicit" as const,
      transforms: [
        {
          id: "bad-prototype",
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
          prototype: "absent",
        },
        {
          id: "unused",
          translation: { x: 1, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
      ],
    },
  };
  const missingRoute = instanceDesign({
    id: "missing-route",
    layout: { kind: "along-route", route: "absent", lateralJitter: 0 },
  });
  const flatRoute = instanceDesign({
    id: "flat-route",
    layout: { kind: "along-route", route: "flat", lateralJitter: 0 },
  });
  const flatRouteWorld = {
    ...world,
    routes: [
      {
        id: "flat",
        waypoints: [
          { x: 1, z: 1 },
          { x: 1, z: 1 },
        ],
        allowedFormationWidth: 1,
      },
    ],
  };
  const longRoute = instanceDesign({
    id: "long-route",
    count: 4,
    layout: { kind: "along-route", route: "long", lateralJitter: 0 },
  });
  const longRouteWorld = {
    ...world,
    routes: [
      {
        id: "long",
        waypoints: [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
          { x: 5, z: 0 },
        ],
        allowedFormationWidth: 1,
      },
    ],
  };

  TestValidator.equals(
    "materialization inventories and malformed slot boundaries are explicit",
    namedFacts([
      [
        "formationInventory",
        () => formationInventory[formation.id]?.id === formation.id,
      ],
      ["instanceInventory", () => instanceInventory[grid.id]?.id === grid.id],
      [
        "nonIntegerSlot",
        () =>
          throwsError(
            () => materializeInstanceSlot(grid, world, 0.5),
            "outside",
          ),
      ],
      [
        "negativeSlot",
        () =>
          throwsError(
            () => materializeInstanceSlot(grid, world, -1),
            "outside",
          ),
      ],
      [
        "pastEndSlot",
        () =>
          throwsError(
            () => materializeInstanceSlot(grid, world, grid.count),
            "outside",
          ),
      ],
      [
        "emptyPalette",
        () =>
          throwsError(
            () =>
              materializeInstanceSlot(
                {
                  ...grid,
                  variation: { ...grid.variation, palette: [] },
                },
                world,
                0,
              ),
            "empty palette",
          ),
      ],
      [
        "missingTransform",
        () =>
          throwsError(
            () => materializeInstanceSlot(missingTransform, world, 1),
            "no explicit transform",
          ),
      ],
      [
        "missingPrototype",
        () =>
          throwsError(
            () => materializeInstanceSlot(missingPrototype, world, 0),
            "missing prototype",
          ),
      ],
      [
        "missingRoute",
        () =>
          throwsError(
            () => materializeInstanceSlot(missingRoute, world, 0),
            "unavailable route",
          ),
      ],
      [
        "flatRoute",
        () =>
          throwsError(
            () => materializeInstanceSlot(flatRoute, flatRouteWorld, 0),
            "finite non-zero length",
          ),
      ],
      [
        "lastRouteSegment",
        () =>
          materializeInstanceSlot(longRoute, longRouteWorld, 3).position.x > 1,
      ],
      [
        "runtimeIdentityExports",
        () =>
          productionRuntimeModelId(baseRecipe.id) !==
            productionRuntimeSkeletonId(baseRecipe.id) &&
          productionRuntimeModelId(baseRecipe.id).length > 0 &&
          productionRuntimeSkeletonId(baseRecipe.id).length > 0,
      ],
    ]),
    {
      formationInventory: true,
      instanceInventory: true,
      nonIntegerSlot: true,
      negativeSlot: true,
      pastEndSlot: true,
      emptyPalette: true,
      missingTransform: true,
      missingPrototype: true,
      missingRoute: true,
      flatRoute: true,
      lastRouteSegment: true,
      runtimeIdentityExports: true,
    },
  );

  const boxRecipe: IAutoMovieModelRecipe = {
    ...baseRecipe,
    id: "external-box",
    lod: [{ tier: "near", maxDistance: null, recipe: "external-box" }],
  };
  const capsuleRecipe: IAutoMovieModelRecipe = {
    ...baseRecipe,
    id: "external-capsule",
    lod: [{ tier: "near", maxDistance: null, recipe: "external-capsule" }],
  };
  const externalModels = new Map<string, IAutoMovieExternalModelRuntimeBinding>(
    [
      [
        boxRecipe.id,
        externalBinding({
          collision: {
            recipe: "box-v1",
            parameters: { width: 2, height: 4, depth: 6 },
          },
          measurement: {
            recipe: "box-v1",
            parameters: { width: 4, height: 6, depth: 8 },
          },
        }),
      ],
      [
        capsuleRecipe.id,
        externalBinding({
          collision: {
            recipe: "capsule-v1",
            parameters: { radius: 0.5, height: 2 },
          },
          measurement: {
            recipe: "humanoid-landmarks-v1",
            parameters: { height: 2, shoulderWidth: 0.5, hipWidth: 0.4 },
          },
        }),
      ],
    ],
  );
  const externalRecipes = new Map([
    [boxRecipe.id, boxRecipe],
    [capsuleRecipe.id, capsuleRecipe],
  ]);
  const imported = materializeProductionModels(externalRecipes, externalModels);
  const boxGeometry = imported.get(boxRecipe.id)?.parts[0]?.geometry;
  const capsuleGeometry = imported.get(capsuleRecipe.id)?.parts[0]?.geometry;
  const prototypeDesign = instanceDesign({
    id: "external-prototypes",
    modelRecipe: boxRecipe.id,
    prototypes: [{ id: "capsule", modelRecipe: capsuleRecipe.id, weight: 3 }],
  });
  const prototypeRuntime = materializeCompiledInstanceSet(
    prototypeDesign,
    { ...world, instanceSets: [prototypeDesign] },
    externalRecipes,
    externalModels,
  );
  const badRecipe = {
    ...baseRecipe,
    id: "unknown-archetype",
    archetype: "missing-archetype",
  } as unknown as IAutoMovieModelRecipe;
  const unencodable = {
    ...badRecipe,
    id: "unencodable",
    parameters: { unsupported: 1n },
  } as unknown as IAutoMovieModelRecipe;
  const digestRecipe: IAutoMovieModelRecipe = {
    ...baseRecipe,
    id: "digest-owner",
    lod: [{ tier: "near", maxDistance: null, recipe: unencodable.id }],
  };
  const digestFormation = materializeCompiledFormation(
    { ...formation, id: "digest-formation", modelRecipe: digestRecipe.id },
    new Map([
      [digestRecipe.id, digestRecipe],
      [unencodable.id, unencodable],
    ]),
  );
  const unknownProjection = materializeCompiledFormation(
    { ...formation, id: "unknown-projection", modelRecipe: badRecipe.id },
    new Map([[badRecipe.id, badRecipe]]),
  );

  TestValidator.equals(
    "external proxies and exceptional recipe identities remain bounded",
    namedFacts([
      [
        "boxCollision",
        () =>
          boxGeometry?.type === "primitive" && boxGeometry.shape.type === "box",
      ],
      [
        "capsuleCollision",
        () =>
          capsuleGeometry?.type === "primitive" &&
          capsuleGeometry.shape.type === "capsule",
      ],
      ["boxMeasurement", () => prototypeRuntime.projectionRadius > 5],
      [
        "humanoidMeasurement",
        () =>
          prototypeRuntime.prototypes?.some(
            (prototype) =>
              prototype.id === "capsule" && prototype.projectionRadius > 1,
          ) === true,
      ],
      [
        "unencodableDigest",
        () =>
          digestFormation.lod[0]?.recipeDigest.startsWith("sha256:") === true,
      ],
      [
        "unknownProjectionFallback",
        () => unknownProjection.projectionRadius === 0.5,
      ],
      [
        "unknownArchetype",
        () =>
          throwsError(
            () =>
              materializeProductionModels(new Map([[badRecipe.id, badRecipe]])),
            "not registered",
          ),
      ],
    ]),
    {
      boxCollision: true,
      capsuleCollision: true,
      boxMeasurement: true,
      humanoidMeasurement: true,
      unencodableDigest: true,
      unknownProjectionFallback: true,
      unknownArchetype: true,
    },
  );

  const unmodelled: IAutoMovieFormationDesign = {
    ...formation,
    id: "unmodelled",
    modelRecipe: "absent-recipe",
    heroOverrides: [],
  };
  const explicitRuntime = materializeCompiledInstanceSet(
    explicit,
    { ...world, instanceSets: [explicit] },
    recipes,
  );
  const runtimeModels = materializeProductionModels(recipes);
  const authored = structuredClone(runtimeModels.get(baseRecipe.id)!);
  authored.id = "authored-model";
  const scene = sceneFixture();
  const source = compiledShotFixture({
    authoredModels: [authored],
    scene: {
      ...scene,
      nodes: [
        ...scene.nodes,
        sourceNode("captain", "old-model"),
        sourceNode(`formation:${formation.id}:slot:000000`, "old-model"),
        sourceNode(`formation:${formation.id}:slot:000001`, "old-model"),
        sourceNode(`formation:${formation.id}:slot:not-a-slot`, "old-model"),
        sourceNode(`instance:${explicit.id}:first`, "old-model"),
        sourceNode(`instance:${explicit.id}:slot:000001`, "old-model"),
        sourceNode(`instance:${explicit.id}:slot:not-a-slot`, "old-model"),
        sourceNode("authored-node", authored.id),
        sourceNode("missing-model-node", "missing-runtime-model"),
      ],
    },
  }) as unknown as IAutoMovieShotSourceOutput;
  const contract = {
    ...shotContract(),
    participants: [
      ...shotContract().participants,
      { kind: "formation" as const, id: "missing-formation" },
      { kind: "formation" as const, id: formation.id },
      { kind: "formation" as const, id: unmodelled.id },
    ],
  };
  const shot = materializeCompiledShot({
    contract,
    formations: new Map([
      [formation.id, formation],
      [unmodelled.id, unmodelled],
    ]),
    formationRuntime: { [formation.id]: formationInventory[formation.id]! },
    instanceSetRuntime: {
      [explicitRuntime.id]: explicitRuntime,
      [prototypeRuntime.id]: prototypeRuntime,
    },
    modelRecipes: recipes,
    runtimeModels,
    world: { ...world, instanceSets: [explicit, prototypeDesign] },
    source,
  });
  const bareSource = {
    ...source,
    authoredModels: undefined,
    formationMotions: undefined,
    formationSlotMotions: undefined,
  };
  const bareShot = materializeCompiledShot({
    contract: shotContract(),
    formations: new Map(),
    runtimeModels: new Map(),
    source: bareSource,
  });
  const effectsWithoutWorld = materializeCompiledEffects({
    contract: shotContract(),
    cues: [],
  });

  TestValidator.equals(
    "shot materialization closes every compact identity branch",
    namedFacts([
      [
        "ordinaryFormationCollision",
        () => shot.collisions.includes(`formation:${formation.id}:slot:000001`),
      ],
      [
        "heroFormationNotCollision",
        () =>
          shot.collisions.includes(`formation:${formation.id}:slot:000000`) ===
          false,
      ],
      [
        "explicitInstanceCollision",
        () => shot.collisions.includes(`instance:${explicit.id}:first`),
      ],
      [
        "ordinaryInstanceCollision",
        () => shot.collisions.includes(`instance:${explicit.id}:slot:000001`),
      ],
      [
        "existingHeroUpdated",
        () =>
          shot.value.scene.nodes.find((node) => node.id === "captain")
            ?.model === runtimeModels.get(baseRecipe.id)?.id,
      ],
      [
        "newHeroAdded",
        () => shot.value.scene.nodes.some((node) => node.id === "recruit"),
      ],
      [
        "authoredModel",
        () => shot.value.models.some((model) => model.id === authored.id),
      ],
      [
        "missingModelFiltered",
        () =>
          shot.value.models.some(
            (model) => model.id === "missing-runtime-model",
          ) === false,
      ],
      [
        "formationFallback",
        () => shot.value.formations.some((item) => item.id === formation.id),
      ],
      [
        "instanceOrder",
        () =>
          JSON.stringify(shot.value.instanceSets.map((item) => item.id)) ===
          JSON.stringify(
            [explicit.id, prototypeDesign.id].sort((left, right) =>
              left < right ? -1 : left > right ? 1 : 0,
            ),
          ),
      ],
      [
        "omittedCollections",
        () =>
          bareShot.value.formationMotions.length === 0 &&
          bareShot.value.formationSlotMotions.length === 0 &&
          bareShot.value.instanceSets.length === 0 &&
          effectsWithoutWorld.length === 0,
      ],
    ]),
    {
      ordinaryFormationCollision: true,
      heroFormationNotCollision: true,
      explicitInstanceCollision: true,
      ordinaryInstanceCollision: true,
      existingHeroUpdated: true,
      newHeroAdded: true,
      authoredModel: true,
      missingModelFiltered: true,
      formationFallback: true,
      instanceOrder: true,
      omittedCollections: true,
    },
  );
};
