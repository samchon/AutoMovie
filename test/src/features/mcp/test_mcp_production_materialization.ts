import {
  IAutoMovieCompiledShotSource,
  IAutoMovieModelRecipe,
  IAutoMovieShotSourceOutput,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  materializeCompiledShot,
  materializeFormationInventory,
  materializeFormationSlots,
  materializeProductionModels,
  productionRuntimeModelId,
  productionRuntimeSkeletonId,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  formationDesign,
  modelRecipe,
  productionFixture,
  shotContract,
} from "./productionFixtures";

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
  palette: { zed: "#112233", amber: "#445566" },
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
 *    reports ordinary-slot collisions, and remains safe when a referenced
 *    formation, inventory, model, or source-only model is absent.
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
  TestValidator.predicate(
    "all bounded model archetypes materialize",
    models.size === recipes.length &&
      models.get("stick")?.id === productionRuntimeModelId("stick") &&
      models.get("stick")?.skeleton?.id ===
        productionRuntimeSkeletonId("stick") &&
      models.get("stick")?.parts.length === 13 &&
      models.get("horse")?.parts.length === 6 &&
      models.get("artillery")?.parts.length === 3 &&
      models.get("flag")?.parts.length === 2 &&
      models.get("weapon")?.materials[0]?.metallic === 0.7 &&
      models.get("weapon")?.materials[0]?.roughness === 0.35 &&
      models.get("box")?.parts[0]?.geometry.type === "primitive" &&
      models.get("sphere")?.parts[0]?.geometry.type === "primitive" &&
      models.get("capsule")?.parts[0]?.geometry.type === "primitive" &&
      models.get("cylinder")?.parts[0]?.geometry.type === "primitive" &&
      models.get("cone")?.parts[0]?.geometry.type === "primitive" &&
      models.get("plane")?.parts[0]?.geometry.type === "primitive" &&
      ["box", "sphere", "capsule", "cylinder", "cone", "plane"].every((id) => {
        const geometry = models.get(id)?.parts[0]?.geometry;
        return geometry?.type === "primitive" && geometry.shape.type === id;
      }),
  );

  const layouts = [
    formationDesign({ kind: "line", ranks: 2, files: 3 }),
    {
      ...formationDesign({ kind: "column", ranks: 2, files: 3 }),
      id: "column",
    },
    { ...formationDesign({ kind: "wedge", depth: 3 }), id: "wedge" },
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
  const inventory = materializeFormationInventory(
    new Map(layouts.map((item) => [item.id, item])),
  );
  TestValidator.predicate(
    "every compact formation layout has deterministic slots",
    slotSets.every((slots, index) => slots.length === layouts[index]!.count) &&
      slotSets[0]![0]?.node === "captain" &&
      slotSets[3]![0]?.node === "arc-hero" &&
      Math.abs(slotSets[3]![0]!.position.x - 4) < 1e-12 &&
      Math.abs(slotSets[3]![0]!.position.z) < 1e-12 &&
      JSON.stringify(slotSets[4]) === JSON.stringify(repeatedScatter) &&
      Object.keys(inventory).length === layouts.length,
  );

  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    TestValidator.predicate(
      "materialization fixture compiles",
      compiler.compile({ scope: "source" }).success,
    );
    const compiled = JSON.parse(
      fs.readFileSync(
        path.join(fixture.root, "generated/shots/opening.json"),
        "utf8",
      ),
    ) as IAutoMovieCompiledShotSource;
    const { models: _compiledModels, ...baseSource } = compiled;
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
    const runtimeModels = materializeProductionModels(
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
      formationSlots,
      runtimeModels,
      source: heroSource,
    });
    const collisionSource = structuredClone(source);
    collisionSource.scene.nodes.push({
      ...collisionSource.scene.nodes[0]!,
      id: "formation:line:slot:000001",
    });
    const collision = materializeCompiledShot({
      contract,
      formations: formationMap,
      formationSlots,
      runtimeModels,
      source: collisionSource,
    });
    const absentFormation = materializeCompiledShot({
      contract,
      formations: new Map(),
      formationSlots: {},
      runtimeModels,
      source,
    });
    const absentInventory = materializeCompiledShot({
      contract,
      formations: formationMap,
      formationSlots: {},
      runtimeModels,
      source,
    });
    const absentModel = materializeCompiledShot({
      contract,
      formations: formationMap,
      formationSlots,
      runtimeModels: new Map(),
      source,
    });
    TestValidator.predicate(
      "compiler owns slot insertion, hero placement and collision reporting",
      materialized.value.scene.nodes.find((node) => node.id === "captain")
        ?.transform.translation.x === formationSlots.line![0]!.position.x &&
        materialized.value.scene.nodes.find((node) => node.id === "captain")
          ?.model === productionRuntimeModelId("stick") &&
        materialized.value.models.every(
          (model) => model.id !== "source-only-model",
        ) &&
        collision.collisions.includes("formation:line:slot:000001") &&
        absentFormation.value.scene.nodes.length ===
          source.scene.nodes.length &&
        absentInventory.value.scene.nodes.length ===
          source.scene.nodes.length &&
        absentModel.value.scene.nodes.length === source.scene.nodes.length,
    );
  } finally {
    fixture.dispose();
  }
};
