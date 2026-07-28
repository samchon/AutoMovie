import { transformFormationPoint } from "@automovie/engine";
import { IAutoMovieModelRecipe } from "@automovie/interface";
import {
  materializeCompiledFormation,
  materializeFormationSlot,
  materializeProductionModels,
} from "@automovie/mcp";
import {
  buildInstancedFormation,
  regenerateFormationSlot,
  sampleFormationMotion,
  selectFormationLod,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { formationDesign, modelRecipe } from "../mcp/productionFixtures";

const propRecipe = (id: string, size: number): IAutoMovieModelRecipe => ({
  ...modelRecipe(),
  id,
  role: "prop",
  archetype: "primitive-prop",
  parameters: {
    shape: "box",
    width: size,
    height: size * 2,
    depth: size,
  },
  capabilities: [],
  lod: [{ tier: "far", maxDistance: null, recipe: id }],
});

/**
 * Compact formations regenerate exact slots and render through bounded LOD
 * batches.
 */
export const test_viewer_formation = (): void => {
  const hero = propRecipe("army-hero", 0.6);
  const near = propRecipe("army-near", 0.4);
  const far = propRecipe("army-far", 0.2);
  hero.lod = [
    { tier: "hero", maxDistance: 10, recipe: hero.id },
    { tier: "near", maxDistance: 50, recipe: near.id },
    { tier: "far", maxDistance: null, recipe: far.id },
  ];
  const recipes = new Map(
    [hero, near, far].map((recipe) => [recipe.id, recipe]),
  );
  const design = {
    ...formationDesign({
      kind: "line",
      ranks: 3,
      files: 1_024,
      spacing: { lateral: 0.8, depth: 0.9 },
    }),
    id: "army",
    modelRecipe: hero.id,
    count: 2_049,
    heroOverrides: [
      { slot: 0, actor: "marshal" },
      { slot: 1_024, actor: "captain" },
    ],
  };
  const formation = materializeCompiledFormation(design, recipes);
  const changedNear = {
    ...near,
    palette: { body: "#abcdef" },
  };
  const changedRecipes = new Map(recipes);
  changedRecipes.set(changedNear.id, changedNear);
  const changedFormation = materializeCompiledFormation(design, changedRecipes);
  const runtimeModels = materializeProductionModels(recipes);
  const models = new Map(
    [...runtimeModels.values()].map((model) => [model.id, model]),
  );
  const motion = {
    id: "army-advance",
    formation: formation.id,
    action: "advance" as const,
    start: 0,
    end: 6,
    from: {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: 0, y: 0, z: -6 },
      facingOffsetDeg: 20,
      spacingScale: { lateral: 1.2, depth: 0.8 },
    },
    easing: "linear" as const,
  };
  const built = buildInstancedFormation({
    formation,
    models,
    motions: [motion],
  });
  const meshes = built.object.children.filter(
    (object): object is THREE.InstancedMesh =>
      object instanceof THREE.InstancedMesh,
  );
  const perTier = new Map<string, number>();
  for (const mesh of meshes) {
    const tier = mesh.name.split(":").at(-1)!;
    perTier.set(tier, (perTier.get(tier) ?? 0) + mesh.count);
  }
  const compilerBoundary = materializeFormationSlot(design, 1_024);
  const viewerBoundary = regenerateFormationSlot(formation, 1_024);
  TestValidator.predicate(
    "chunk batches exclude heroes and preserve exact compiler slot regeneration",
    formation.chunks.length === 3 &&
      meshes.length === formation.chunks.length * formation.lod.length &&
      [...perTier.values()].every(
        (count) => count === formation.anonymousCount,
      ) &&
      meshes.every(
        (mesh) =>
          mesh.geometry.getAttribute("automoviePhase")?.count === mesh.count &&
          mesh.frustumCulled === false,
      ) &&
      JSON.stringify(compilerBoundary) === JSON.stringify(viewerBoundary) &&
      formation.digest !== changedFormation.digest &&
      formation.lod.find((lod) => lod.tier === "near")?.recipeDigest !==
        changedFormation.lod.find((lod) => lod.tier === "near")?.recipeDigest,
  );

  const nearSelection = selectFormationLod({
    lod: formation.lod,
    distance: 5,
    projectedPixels: 24,
    previous: null,
  });
  const retainedNear = selectFormationLod({
    lod: formation.lod,
    distance: 52,
    projectedPixels: 24,
    previous: "near",
  });
  const retainedWithExplicitHysteresis = selectFormationLod({
    lod: formation.lod,
    distance: 55,
    projectedPixels: 24,
    previous: "near",
    hysteresis: 0.2,
  });
  const farSelection = selectFormationLod({
    lod: formation.lod,
    distance: 56,
    projectedPixels: 24,
    previous: "near",
  });
  const projectedFar = selectFormationLod({
    lod: formation.lod,
    distance: 5,
    projectedPixels: 2,
    previous: null,
  });
  const zeroProjectedFar = selectFormationLod({
    lod: formation.lod,
    distance: 5,
    projectedPixels: 0,
    previous: null,
  });
  const retainedFar = selectFormationLod({
    lod: formation.lod,
    distance: 45,
    projectedPixels: 24,
    previous: "far",
  });
  const switchedNear = selectFormationLod({
    lod: formation.lod,
    distance: 44,
    projectedPixels: 24,
    previous: "far",
  });
  const unchangedNear = selectFormationLod({
    lod: formation.lod,
    distance: 5,
    projectedPixels: 24,
    previous: "near",
  });
  const missingUnboundedFallback = selectFormationLod({
    lod: formation.lod.map((lod) => ({ ...lod, maxDistance: 1 })),
    distance: 100,
    projectedPixels: 24,
    previous: null,
  });
  TestValidator.predicate(
    "automatic LOD combines distance, projected size and hysteresis",
    nearSelection.lod.tier === "near" &&
      retainedNear.lod.tier === "near" &&
      retainedWithExplicitHysteresis.lod.tier === "near" &&
      farSelection.lod.tier === "far" &&
      projectedFar.lod.tier === "far" &&
      zeroProjectedFar.lod.tier === "far" &&
      retainedFar.lod.tier === "far" &&
      switchedNear.lod.tier === "near" &&
      unchangedNear.lod.tier === "near" &&
      missingUnboundedFallback.lod.tier === "far" &&
      (() => {
        try {
          selectFormationLod({
            lod: [],
            distance: 1,
            projectedPixels: 1,
            previous: null,
          });
          return false;
        } catch {
          return true;
        }
      })(),
  );

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 2_000);
  camera.position.set(0, 5, 20);
  camera.lookAt(0, 0, 0);
  built.update(camera, 1_080, 3);
  const firstMatrix = new THREE.Matrix4();
  meshes[0]!.getMatrixAt(0, firstMatrix);
  const firstTranslation = new THREE.Vector3().setFromMatrixPosition(
    firstMatrix,
  );
  const firstAnonymous = regenerateFormationSlot(formation, 1);
  const firstScaled = transformFormationPoint(
    firstAnonymous.position,
    formation.anchor,
    {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1.1, depth: 0.9 },
    },
    formation.facingDeg,
  );
  const sampledMotion = sampleFormationMotion([motion], formation.id, 3);
  const easingSamples = (
    ["linear", "easeIn", "easeOut", "easeInOut", "step"] as const
  ).map((easing) =>
    sampleFormationMotion([{ ...motion, easing }], formation.id, 3),
  );
  const easeInOutQuarter = sampleFormationMotion(
    [{ ...motion, easing: "easeInOut" }],
    formation.id,
    1.5,
  );
  const delayedMotion = {
    ...motion,
    id: "army-delayed",
    start: 8,
    end: 10,
    from: motion.to,
    to: { ...motion.to, translation: { x: 0, y: 0, z: -10 } },
  };
  const beforeMotion = sampleFormationMotion([motion], formation.id, -1);
  const betweenMotions = sampleFormationMotion(
    [delayedMotion, motion],
    formation.id,
    7,
  );
  const afterMotions = sampleFormationMotion(
    [delayedMotion, motion],
    formation.id,
    11,
  );
  const unrelatedMotion = sampleFormationMotion([motion], "other", 3);
  const sameStartA = {
    ...motion,
    id: "a",
    to: { ...motion.to, translation: { x: 0, y: 0, z: -2 } },
  };
  const sameStartB = {
    ...motion,
    id: "b",
    to: { ...motion.to, translation: { x: 0, y: 0, z: -4 } },
  };
  const sameStartSamples = [
    sampleFormationMotion([sameStartB, sameStartA], formation.id, 3),
    sampleFormationMotion([sameStartA, sameStartB], formation.id, 3),
    sampleFormationMotion([sameStartA, { ...sameStartA }], formation.id, 3),
  ];
  const transformed = transformFormationPoint(
    { x: 1, y: 2, z: 0 },
    { x: 0, y: 0, z: 0 },
    {
      translation: { x: 3, y: 4, z: 5 },
      facingOffsetDeg: 90,
      spacingScale: { lateral: 2, depth: 3 },
    },
  );
  const baseFacingTransformed = transformFormationPoint(
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: 0 },
    {
      translation: { x: 0, y: 0, z: 0 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 2, depth: 3 },
    },
    90,
  );
  const visible =
    built.stats.visible.hero +
    built.stats.visible.near +
    built.stats.visible.far;
  TestValidator.predicate(
    "camera update culls whole chunks and reports a bounded visible inventory",
    visible + built.stats.culled === formation.anonymousCount &&
      built.stats.heroes === formation.heroes.length &&
      meshes.filter((mesh) => mesh.visible).length <= formation.chunks.length &&
      sampledMotion.translation.z === -3 &&
      sampledMotion.facingOffsetDeg === 10 &&
      sampledMotion.spacingScale.lateral === 1.1 &&
      built.object.position.z === formation.anchor.z - 3 &&
      built.object.scale.x === 1 &&
      Math.abs(firstTranslation.x - (firstScaled.x - formation.anchor.x)) <
        1e-5 &&
      easingSamples.map((sample) => sample.translation.z).join(",") ===
        "-3,-1.5,-4.5,-3,0" &&
      easeInOutQuarter.translation.z === -0.75 &&
      beforeMotion.translation.z === 0 &&
      betweenMotions.translation.z === -6 &&
      afterMotions.translation.z === -10 &&
      unrelatedMotion.translation.z === 0 &&
      sameStartSamples.every((sample) => sample.translation.z === -1) &&
      Math.abs(transformed.x - 3) < 1e-12 &&
      transformed.y === 6 &&
      transformed.z === 3 &&
      Math.abs(baseFacingTransformed.x) < 1e-12 &&
      baseFacingTransformed.z === -2,
  );

  TestValidator.predicate(
    "missing LOD runtime models fail closed",
    (() => {
      try {
        buildInstancedFormation({ formation, models: new Map() });
        return false;
      } catch {
        return true;
      }
    })(),
  );

  const heroesOnly = materializeCompiledFormation(
    {
      ...design,
      count: 2,
      layout: {
        kind: "line",
        ranks: 1,
        files: 2,
        spacing: { lateral: 1, depth: 1 },
      },
      heroOverrides: [
        { slot: 0, actor: "first" },
        { slot: 1, actor: "second" },
      ],
    },
    recipes,
  );
  TestValidator.predicate(
    "an all-hero chunk creates no zero-count instance mesh",
    buildInstancedFormation({ formation: heroesOnly, models }).object.children
      .length === 0,
  );
};
