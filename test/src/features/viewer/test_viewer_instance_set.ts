import {
  IAutoMovieModelRecipe,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  materializeCompiledInstanceSet,
  materializeInstanceSlot,
  materializeProductionModels,
} from "@automovie/mcp";
import {
  buildInstancedInstanceSet,
  regenerateInstanceSlot,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts } from "../internal/predicates";
import { modelRecipe, worldDesign } from "../mcp/productionFixtures";

/** General instance sets render as colored, trait-bearing bounded batches. */
export const test_viewer_instance_set = (): void => {
  const recipe: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "tree",
    role: "prop",
    archetype: "primitive-prop",
    parameters: {
      shape: "cone",
      radius: 0.6,
      height: 3,
    },
    palette: { foliage: "#804020" },
    lod: [{ tier: "near", maxDistance: null, recipe: "tree" }],
    capabilities: [],
    attachments: [],
  };
  const design = {
    id: "forest",
    modelRecipe: recipe.id,
    count: 32,
    layout: {
      kind: "grid" as const,
      rows: 4,
      columns: 8,
      spacing: { x: 1.5, z: 1.5 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    facingDeg: 15,
    seed: 7,
    variation: {
      scale: { min: 0.8, max: 1.2 },
      palette: ["#335522", "#557733"],
      traits: [
        { name: "wind", min: 0, max: 1 },
        { name: "__proto__", min: 2, max: 3 },
      ],
    },
  };
  const world: IAutoMovieWorldDesign = {
    ...worldDesign(),
    instanceSets: [design],
  };
  const recipes = new Map([[recipe.id, recipe]]);
  const compiled = materializeCompiledInstanceSet(design, world, recipes);
  const runtimeModels = materializeProductionModels(recipes);
  const models = new Map(
    [...runtimeModels.values()].map((model) => [model.id, model]),
  );
  const built = buildInstancedInstanceSet({
    instanceSet: compiled,
    models,
  });
  const meshes = built.object.children.filter(
    (object): object is THREE.InstancedMesh =>
      object instanceof THREE.InstancedMesh,
  );
  const compilerSlot = materializeInstanceSlot(design, world, 17);
  const viewerSlot = regenerateInstanceSlot(compiled, 17);
  const firstSlot = materializeInstanceSlot(design, world, 0);
  const firstColor = new THREE.Color();
  meshes[0]?.getColorAt(0, firstColor);
  TestValidator.equals(
    "viewer batches preserve compiler slot, scale, palette and trait streams",
    namedFacts([
      [
        "stringifyCompilerSlotStringify",
        () => JSON.stringify(compilerSlot) === JSON.stringify(viewerSlot),
      ],
      [
        "meshesCompiledChunks",
        () => meshes.length === compiled.chunks.length * compiled.lod.length,
      ],
      [
        "meshesMeshMesh",
        () =>
          meshes.every(
            (mesh) =>
              mesh.count > 0 &&
              mesh.instanceColor?.count === mesh.count &&
              mesh.geometry.getAttribute("automovieTrait0")?.count ===
                mesh.count &&
              mesh.geometry.getAttribute("automovieTrait1")?.count ===
                mesh.count &&
              mesh.userData.automovieTraitNames[0] === "wind" &&
              mesh.userData.automovieTraitNames[1] === "__proto__" &&
              mesh.frustumCulled === false &&
              (Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material]
              ).every(
                (material) =>
                  "color" in material &&
                  material.color instanceof THREE.Color &&
                  material.color.getHex() === 0xffffff,
              ),
          ),
      ],
      [
        "firstColorGetHexStringFirstSlot",
        () => firstColor.getHexString() === firstSlot.palette.slice(1),
      ],
    ]),
    {
      stringifyCompilerSlotStringify: true,
      meshesCompiledChunks: true,
      meshesMeshMesh: true,
      firstColorGetHexStringFirstSlot: true,
    },
  );

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(0, 10, 24);
  camera.lookAt(0, 0, 0);
  built.update(camera, 720);
  TestValidator.predicate(
    "visible and culled accounting always equals the compact inventory",
    built.stats.visible.hero +
      built.stats.visible.near +
      built.stats.visible.far +
      built.stats.culled ===
      compiled.count,
  );
  camera.position.set(0, 10, 24);
  camera.lookAt(0, 0, 500);
  built.update(camera, 720);
  TestValidator.equals(
    "off-frustum chunks are hidden without expanding nodes",
    namedFacts([
      ["builtStatsCulled", () => built.stats.culled === compiled.count],
      [
        "meshesEveryMesh",
        () =>
          built.stats.culled === compiled.count &&
          meshes.every((mesh) => mesh.visible === false),
      ],
    ]),
    { builtStatsCulled: true, meshesEveryMesh: true },
  );

  TestValidator.error("missing instance LOD model throws", () =>
    buildInstancedInstanceSet({
      instanceSet: compiled,
      models: new Map(),
    }),
  );
  TestValidator.error(
    "instance regeneration rejects an out-of-range slot",
    () => regenerateInstanceSlot(compiled, compiled.count),
  );
  TestValidator.error(
    "route regeneration requires compiled route geometry",
    () =>
      regenerateInstanceSlot(
        {
          ...compiled,
          layout: {
            kind: "along-route",
            route: "missing",
            lateralJitter: 0,
          },
          route: null,
        },
        0,
      ),
  );
};
